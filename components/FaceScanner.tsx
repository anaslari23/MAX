
import React, { useEffect, useRef, useState } from 'react';
import { AuthLevel } from '../types';

interface FaceScannerProps {
  authLevel: AuthLevel;
  active: boolean;
}

const FaceScanner: React.FC<FaceScannerProps> = ({ authLevel, active }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (active) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(s => {
          setStream(s);
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch(err => console.error("Camera error:", err));
    } else {
      stream?.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [active]);

  return (
    <div className={`relative w-48 h-48 rounded-2xl overflow-hidden border-2 transition-all duration-500 ${
      authLevel === AuthLevel.RECOGNIZED_OWNER ? 'border-emerald-500' : 
      authLevel === AuthLevel.UNKNOWN_FACE ? 'border-amber-500' : 'border-slate-800'
    }`}>
      {active ? (
        <>
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            className="w-full h-full object-cover grayscale opacity-60"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {/* HUD Overlay */}
            <div className="w-40 h-40 border border-cyan-500/30 rounded-full animate-pulse flex items-center justify-center">
              <div className="w-32 h-32 border border-cyan-500/20 rounded-full animate-[spin_10s_linear_infinite]" />
            </div>
            
            <div className="absolute top-2 left-2 text-[10px] text-cyan-500 font-mono tracking-tighter">
              [ SCANNING_BIOS ]<br/>
              LEVEL: {authLevel}
            </div>

            <div className="absolute bottom-2 px-3 py-1 bg-black/60 rounded text-[10px] font-bold tracking-widest uppercase border border-white/10">
              {authLevel === AuthLevel.RECOGNIZED_OWNER ? 'Owner Verified' : 'Authentication Required'}
            </div>
          </div>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-900/50">
          <span className="text-slate-700 text-[10px] uppercase tracking-widest">Camera Off</span>
        </div>
      )}
    </div>
  );
};

export default FaceScanner;
