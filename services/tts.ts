
import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
let currentSource: AudioBufferSourceNode | null = null;
const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
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

export function stopSpeech() {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch (e) {}
    currentSource = null;
  }
}

export async function speakAI(text: string, onStart?: () => void, onEnd?: () => void) {
  try {
    stopSpeech(); 

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ 
        parts: [{ 
          text: `You are MAX, a sophisticated OS intelligence. Speak this with a calm, resonant, and professional British tone: ${text}` 
        }] 
      }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore is the most sophisticated male-coded voice
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data received");

    const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), audioContext);
    
    if (onStart) onStart();

    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    source.buffer = audioBuffer;
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    source.onended = () => {
      if (currentSource === source) {
        currentSource = null;
        if (onEnd) onEnd();
      }
    };

    currentSource = source;
    source.start();
    return audioBuffer.duration;
  } catch (error) {
    console.error("TTS Error:", error);
    // Fallback to native speech if Gemini TTS fails
    const utterance = new SpeechSynthesisUtterance(text);
    if (onStart) onStart();
    utterance.onend = () => { if (onEnd) onEnd(); };
    window.speechSynthesis.speak(utterance);
  }
}
