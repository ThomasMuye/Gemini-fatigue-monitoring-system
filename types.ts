
export enum FatigueLevel {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HEAVY = 'HEAVY'
}

export interface AnalysisResult {
  fatigueLevel: FatigueLevel;
  blinkRate: number; // Blinks per minute estimate
  headAngle: number; // Degrees of tilt
  eyeStatus: 'OPEN' | 'CLOSED' | 'DROOPY';
  yawnDetected: boolean;
  confidence: number;
  reasoning: string;
}

export interface SystemLog {
  timestamp: Date;
  level: FatigueLevel;
  message: string;
}
