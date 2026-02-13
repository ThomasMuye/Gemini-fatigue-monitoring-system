
export enum FatigueLevel {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HEAVY = 'HEAVY'
}

export enum Language {
  EN = 'EN',
  CN = 'CN'
}

export enum EngineType {
  WEB = 'WEB',
  PYTHON = 'PYTHON',
  CPP = 'CPP'
}

export interface AnalysisResult {
  fatigueLevel: FatigueLevel;
  blinkRate: number;
  headAngle: number;
  eyeStatus: 'OPEN' | 'CLOSED' | 'DROOPY';
  yawnDetected: boolean;
  confidence: number;
  reasoning: string;
}

export interface SystemLog {
  timestamp: Date;
  level: FatigueLevel;
  message: string;
  engine: EngineType;
}
