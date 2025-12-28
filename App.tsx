
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { MaxState, SystemStats as SystemStatsType } from './types';
import Orb from './components/Orb';

// --- Audio Utilities ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [state, setState] = useState<MaxState>(MaxState.IDLE);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [sensitivity, setSensitivity] = useState(0.6); // Default sensitivity
  const [stats, setStats] = useState<SystemStatsType>({
    cpu: 4, ram: 18, disk: 12, battery: 100, neuralLatency: 1, packetVelocity: 850
  });

  const sessionRef = useRef<any>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const localRecognitionRef = useRef<any>(null);

  // --- Realtime Connection Logic ---
  const connectLive = async (silentInit = false) => {
    if (sessionRef.current) return;

    // Stop local recognition to free up the microphone
    if (localRecognitionRef.current) {
      localRecognitionRef.current.stop();
    }

    setState(MaxState.THINKING);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: "You are MAX, a realtime Jarvis-like OS intelligence. You respond with dry British wit and call the user 'Sir'. Be concise, instantaneous, and extremely competent. Sir just woke you up via wake-word. Acknowledge him briefly and await orders.",
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setState(MaxState.IDLE);
            const source = audioContextInRef.current!.createMediaStreamSource(stream);
            const processor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const sum = inputData.reduce((a, b) => a + b * b, 0);
              if (state !== MaxState.SPEAKING) setAudioLevel(Math.sqrt(sum / inputData.length) * 5);

              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  media: {
                    data: encode(new Uint8Array(int16.buffer)),
                    mimeType: 'audio/pcm;rate=16000',
                  },
                });
              });
            };

            source.connect(processor);
            processor.connect(audioContextInRef.current!.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setState(MaxState.SPEAKING);
              const ctx = audioContextOutRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setState(MaxState.IDLE);
              };

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setState(MaxState.LISTENING);
            }

            if (msg.serverContent?.inputAudioTranscription) setTranscription(msg.serverContent.inputAudioTranscription.text);
            if (msg.serverContent?.outputTranscription) setTranscription(msg.serverContent.outputTranscription.text);
          },
          onclose: () => {
            setState(MaxState.PAUSED);
            sessionRef.current = null;
            initLocalWakeWord(); // Re-start local listener if session closes
          },
          onerror: (e) => console.error("MAX Realtime Error:", e),
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (e) {
      console.error("Mic Access Error:", e);
      setState(MaxState.PAUSED);
    }
  };

  // --- Local Wake Word Detection ---
  const initLocalWakeWord = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition || sessionRef.current) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let result = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        result += event.results[i][0].transcript;
      }
      
      const normalized = result.toLowerCase();
      
      // Sensitivity Keywords
      const keywords = ['hey max', 'hey macs', 'max'];
      if (sensitivity > 0.8) keywords.push('hey', 'hello', 'mate');
      if (sensitivity < 0.4) {
         // Strict mode: Only "hey max"
         if (normalized.includes('hey max')) connectLive();
      } else {
         if (keywords.some(k => normalized.includes(k))) connectLive();
      }
    };

    recognition.onend = () => {
      if (!sessionRef.current) recognition.start();
    };

    try {
      recognition.start();
      localRecognitionRef.current = recognition;
    } catch (e) {}
  };

  useEffect(() => {
    initLocalWakeWord();
    return () => localRecognitionRef.current?.stop();
  }, [sensitivity]);

  useEffect(() => {
    const timer = setInterval(() => {
      setStats(prev => ({
        ...prev,
        cpu: Math.max(2, Math.min(10, prev.cpu + (Math.random() - 0.5))),
        neuralLatency: 1,
        packetVelocity: 900 + Math.floor(Math.random() * 100)
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#02040a] text-white flex flex-col items-center justify-center p-6 font-space select-none overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#0f172a,transparent)] opacity-40 pointer-events-none" />
      
      {/* Left Sidebar HUD: Sensitivity Tuning */}
      <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-6 opacity-40 hover:opacity-100 transition-opacity duration-500">
        <div className="text-[10px] uppercase tracking-[0.5em] font-bold vertical-text rotate-180 mb-4 text-cyan-500">
          Neural Sensitivity
        </div>
        <div className="h-64 w-[2px] bg-white/10 relative rounded-full overflow-hidden">
          <div 
            className="absolute bottom-0 left-0 right-0 bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-all duration-300" 
            style={{ height: `${sensitivity * 100}%` }}
          />
          <input 
            type="range" 
            min="0.1" 
            max="1.0" 
            step="0.05" 
            value={sensitivity}
            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none orientation-vertical"
            style={{ writingMode: 'bt-lr' } as any}
          />
        </div>
        <div className="text-[10px] font-mono text-cyan-400 font-bold">
          {Math.floor(sensitivity * 100)}%
        </div>
      </div>

      <div className="absolute top-8 left-8 right-8 flex justify-between items-center opacity-40">
        <div className="flex gap-8 text-[10px] uppercase tracking-[0.4em] font-bold">
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse" />
            CPU {stats.cpu.toFixed(1)}%
          </div>
          <div>NET {stats.packetVelocity} MB/S</div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-cyan-500">
          MAX_OS_REALTIME_V2
        </div>
      </div>

      <div className="flex flex-col items-center gap-12 z-10">
        <Orb state={state} audioLevel={audioLevel} />
        
        <div className="flex flex-col items-center gap-4 text-center max-w-2xl">
          <h1 className="text-8xl font-light tracking-[1em] text-white/90 translate-x-4">MAX</h1>
          
          <div className="h-20 flex items-center justify-center">
            {state === MaxState.THINKING ? (
              <div className="text-[11px] text-cyan-500 uppercase tracking-[1em] animate-pulse">Initializing Core...</div>
            ) : !sessionRef.current ? (
              <div className="flex flex-col items-center gap-2">
                <div className="text-[11px] text-slate-500 uppercase tracking-[1.2em] animate-pulse">Say "Hey Max"</div>
                <div className="text-[8px] text-slate-700 uppercase tracking-[0.5em]">Neural Standby Active</div>
              </div>
            ) : (
              <p className="text-xl text-white/60 font-light italic animate-in fade-in slide-in-from-bottom-2">
                "{transcription || "Listening..."}"
              </p>
            )}
          </div>
        </div>
      </div>

      {!sessionRef.current && (
        <button 
          onClick={() => connectLive()}
          className="group relative mt-12 px-10 py-4 bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 rounded-full transition-all active:scale-95"
        >
          <span className="text-[10px] uppercase tracking-[0.5em] font-bold text-slate-400 group-hover:text-cyan-400">Manual Override</span>
        </button>
      )}

      {sessionRef.current && (
        <div className="mt-12 flex items-center gap-6 opacity-60">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_#10b981]" />
          <span className="text-[10px] uppercase tracking-[0.5em] font-bold text-emerald-400">System Link: Verified</span>
        </div>
      )}

      <div className="absolute bottom-10 text-[9px] uppercase tracking-[1em] text-white/10">
        Neural Gateway: {sessionRef.current ? 'Persistent' : 'Passive'}
      </div>

      <style>{`
        .vertical-text {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `}</style>
    </div>
  );
};

export default App;
