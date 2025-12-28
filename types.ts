
export enum MaxState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  PAUSED = 'PAUSED'
}

// Added missing AuthLevel enum to resolve compilation error in FaceScanner.tsx
export enum AuthLevel {
  NOT_SCANNED = 'NOT_SCANNED',
  RECOGNIZED_OWNER = 'RECOGNIZED_OWNER',
  UNKNOWN_FACE = 'UNKNOWN_FACE',
  UNAUTHORIZED = 'UNAUTHORIZED'
}

export interface SystemStats {
  cpu: number;
  ram: number;
  disk: number;
  battery: number;
  neuralLatency: number;
  packetVelocity: number;
}

export interface CommandLog {
  id: string;
  type: 'USER' | 'MAX' | 'SYSTEM' | 'AGENT';
  message: string;
  timestamp: Date;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: any[];
}

export interface PersistentMemory {
  ownerName: string;
  preferences: Record<string, any>;
  longTermContext: string[];
  habits: string[];
}
