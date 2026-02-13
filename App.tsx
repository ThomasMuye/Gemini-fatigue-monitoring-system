
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, AlertTriangle, ShieldCheck, Activity, Volume2, 
  Settings, List, Terminal, Download, Monitor, Languages, 
  Code2, Cpu, Box, Play, Square, RefreshCcw
} from 'lucide-react';
import { FatigueLevel, AnalysisResult, SystemLog, Language, EngineType } from './types';
import { analyzeDriverState, generateAlertAudioBase64, decodeBase64, decodePcmData } from './services/geminiService';
import StatCard from './components/StatCard';

const TRANSLATIONS = {
  [Language.CN]: {
    title: "GuardDrive AI",
    subTitle: "长途驾驶疲劳智能预警系统",
    engineWeb: "Web 原生引擎",
    enginePython: "Python 核心引擎",
    engineCpp: "C++ 原生引擎",
    statusStandby: "等待初始化",
    statusRunning: "引擎运行中",
    startEngine: "启动引擎",
    stopEngine: "停止引擎",
    monitoring: "实时视觉流监测",
    telemetry: "系统遥测 (Telemetry)",
    hardware: "底层硬件状态",
    cpuUsage: "CPU 占用",
    memory: "内存分配",
    volControl: "音量自动化",
    blinkRate: "眨眼频率",
    headTilt: "头部姿态",
    eyeStatus: "眼睛状态",
    confidence: "置信度",
    downloadSource: "下载当前引擎源码",
    reasoning: "AI 分析逻辑",
    emergency: "!!! 严重疲劳预警：请立即停车 !!!",
    logs: {
      started: (eng: string) => `[SYSTEM] ${eng} 引擎初始化成功，加载模型中...`,
      stopped: (eng: string) => `[SYSTEM] ${eng} 引擎已安全关闭。`,
      analyzing: "[AI] 正在提取面部特征向量...",
      warning: "[WARN] 检测到疲劳迹象，触发语音播报。",
      critical: "[CRIT] 紧急状态！开启最大音量警报！"
    }
  },
  [Language.EN]: {
    title: "GuardDrive AI",
    subTitle: "Fatigue Monitoring System",
    engineWeb: "Web Engine",
    enginePython: "Python Core",
    engineCpp: "C++ Native",
    statusStandby: "STANDBY",
    statusRunning: "RUNNING",
    startEngine: "START ENGINE",
    stopEngine: "STOP ENGINE",
    monitoring: "LIVE VISION STREAM",
    telemetry: "SYSTEM TELEMETRY",
    hardware: "HARDWARE STATUS",
    cpuUsage: "CPU Usage",
    memory: "Memory Alloc",
    volControl: "Auto Volume",
    blinkRate: "Blink Rate",
    headTilt: "Head Tilt",
    eyeStatus: "Eye Status",
    confidence: "Confidence",
    downloadSource: "Download Source",
    reasoning: "AI Reasoning",
    emergency: "!!! CRITICAL FATIGUE: PULL OVER !!!",
    logs: {
      started: (eng: string) => `[SYSTEM] ${eng} engine initialized. Loading models...`,
      stopped: (eng: string) => `[SYSTEM] ${eng} engine shut down safely.`,
      analyzing: "[AI] Extracting facial feature vectors...",
      warning: "[WARN] Fatigue signs detected. Triggering TTS.",
      critical: "[CRIT] EMERGENCY! Triggering max volume alarm!"
    }
  }
};

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(Language.CN);
  const [engine, setEngine] = useState<EngineType>(EngineType.WEB);
  const [isRunning, setIsRunning] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [audioVolume, setAudioVolume] = useState(1.0);
  const [isEmergency, setIsEmergency] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const loopRef = useRef<number | null>(null);

  const t = TRANSLATIONS[lang];

  const addLog = useCallback((level: FatigueLevel, message: string) => {
    setLogs(prev => [{ timestamp: new Date(), level, message, engine }, ...prev].slice(0, 30));
  }, [engine]);

  // UI 风格切换逻辑
  const getThemeColors = () => {
    switch(engine) {
      case EngineType.PYTHON: return { border: 'border-yellow-500/30', text: 'text-yellow-500', bg: 'bg-stone-950', accent: 'bg-yellow-600' };
      case EngineType.CPP: return { border: 'border-cyan-500/30', text: 'text-cyan-400', bg: 'bg-slate-950', accent: 'bg-cyan-600' };
      default: return { border: 'border-indigo-500/30', text: 'text-indigo-400', bg: 'bg-slate-900', accent: 'bg-indigo-600' };
    }
  };

  const theme = getThemeColors();

  const handleAnalysis = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isRunning) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (context) {
      canvas.width = 320;
      canvas.height = 240;
      context.drawImage(videoRef.current, 0, 0, 320, 240);
      const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];

      try {
        addLog(FatigueLevel.LOW, t.logs.analyzing);
        const result = await analyzeDriverState(base64, lang);
        setAnalysis(result);

        if (result.fatigueLevel === FatigueLevel.HEAVY) {
          setIsEmergency(true);
          setAudioVolume(0.2);
          addLog(FatigueLevel.HEAVY, t.logs.critical);
        } else if (result.fatigueLevel === FatigueLevel.MODERATE) {
          setIsEmergency(false);
          setAudioVolume(0.7);
          addLog(FatigueLevel.MODERATE, t.logs.warning);
        } else {
          setIsEmergency(false);
          setAudioVolume(1.0);
        }
      } catch (err) {
        console.error("Engine failure:", err);
      }
    }
  }, [isRunning, lang, t, addLog]);

  const toggleEngine = async () => {
    if (!isRunning) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
        setIsRunning(true);
        addLog(FatigueLevel.LOW, t.logs.started(engine));
      } catch (err) {
        alert("Camera Error");
      }
    } else {
      setIsRunning(false);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      setAnalysis(null);
      setIsEmergency(false);
      addLog(FatigueLevel.LOW, t.logs.stopped(engine));
    }
  };

  useEffect(() => {
    if (isRunning) {
      loopRef.current = window.setInterval(handleAnalysis, engine === EngineType.CPP ? 4000 : 6000);
    } else {
      if (loopRef.current) clearInterval(loopRef.current);
    }
    return () => { if (loopRef.current) clearInterval(loopRef.current); };
  }, [isRunning, handleAnalysis, engine]);

  return (
    <div className={`min-h-screen flex flex-col ${theme.bg} ${isEmergency ? 'emergency-flash' : ''} transition-all duration-500`}>
      {/* 顶部导航：引擎选择器 */}
      <header className={`h-20 px-6 flex items-center justify-between border-b ${theme.border} backdrop-blur-xl sticky top-0 z-50`}>
        <div className="flex items-center gap-6">
          <div className={`${theme.accent} p-2.5 rounded-xl shadow-lg`}>
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-white uppercase italic">{t.title}</h1>
            <p className={`text-[10px] font-bold ${theme.text} tracking-[0.2em] uppercase opacity-70`}>{t.subTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
          {[EngineType.WEB, EngineType.PYTHON, EngineType.CPP].map(type => (
            <button
              key={type}
              onClick={() => { setEngine(type); setIsRunning(false); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                engine === type ? `${theme.accent} text-white shadow-xl` : 'text-slate-400 hover:text-white'
              }`}
            >
              {type === EngineType.PYTHON ? <Code2 className="w-4 h-4" /> : type === EngineType.CPP ? <Cpu className="w-4 h-4" /> : <Box className="w-4 h-4" />}
              {type}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setLang(lang === Language.CN ? Language.EN : Language.CN)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-xs font-bold"
          >
            <Languages className="w-4 h-4 text-indigo-400" />
            {lang === Language.CN ? "English" : "中文"}
          </button>
          
          <button 
            onClick={toggleEngine}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-black text-sm tracking-widest transition-all ${
              isRunning 
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20 shadow-2xl' 
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 shadow-2xl'
            }`}
          >
            {isRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isRunning ? t.stopEngine : t.startEngine}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row p-8 gap-8 overflow-hidden">
        {/* 左侧：视觉监测流 */}
        <div className="flex-1 flex flex-col gap-6">
          <div className={`relative aspect-video rounded-3xl overflow-hidden border-2 ${theme.border} bg-black shadow-2xl group`}>
            {/* 模拟扫描线（仅C++模式） */}
            {engine === EngineType.CPP && isRunning && <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] z-10 opacity-30"></div>}
            
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            <canvas ref={canvasRef} className="hidden" />

            {!isRunning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-center space-y-4">
                 <div className={`p-6 rounded-full ${theme.accent} bg-opacity-10 animate-pulse`}>
                    <Camera className={`w-12 h-12 ${theme.text}`} />
                 </div>
                 <h2 className="text-xl font-bold text-white">{t.statusStandby}</h2>
                 <p className="text-slate-500 max-w-xs text-sm">{lang === Language.CN ? "请选择引擎并点击启动，系统将开始监测驾驶员生物状态。" : "Select an engine and start to monitor driver biometrics."}</p>
              </div>
            )}

            {isRunning && (
              <div className="absolute top-6 left-6 flex flex-col gap-2">
                 <div className="flex items-center gap-3 px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-black mono text-white tracking-widest uppercase">{t.monitoring}</span>
                 </div>
                 <div className="px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-lg border border-white/5">
                    <span className="text-[10px] mono text-slate-400">ENGINE: {engine} | ARCH: {engine === EngineType.CPP ? 'x64_AVX2' : 'Python_Runtime'}</span>
                 </div>
              </div>
            )}

            {analysis && (
              <div className="absolute bottom-6 left-6 right-6 p-5 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10">
                 <h4 className={`text-[10px] font-black ${theme.text} uppercase mb-2 tracking-[0.2em]`}>{t.reasoning}</h4>
                 <p className="text-sm text-slate-200 italic font-medium leading-relaxed">"{analysis.reasoning}"</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <StatCard label={t.blinkRate} value={analysis?.blinkRate || '--'} unit="BPM" icon={<Activity className="w-4 h-4" />} status={analysis?.blinkRate && analysis.blinkRate < 10 ? 'warning' : 'normal'} />
             <StatCard label={t.headTilt} value={analysis?.headAngle || '--'} unit="DEG" icon={<Settings className="w-4 h-4" />} status={analysis?.headAngle && analysis.headAngle > 20 ? 'warning' : 'normal'} />
             <StatCard label={t.eyeStatus} value={analysis?.eyeStatus || '--'} icon={<Camera className="w-4 h-4" />} status={analysis?.eyeStatus === 'DROOPY' ? 'warning' : analysis?.eyeStatus === 'CLOSED' ? 'danger' : 'normal'} />
             <StatCard label={t.confidence} value={analysis ? Math.round(analysis.confidence * 100) : '--'} unit="%" icon={<RefreshCcw className="w-4 h-4" />} />
          </div>
        </div>

        {/* 右侧：遥测与控制 */}
        <div className="w-full lg:w-[400px] flex flex-col gap-6">
           {/* 引擎控制面板 */}
           <div className={`p-6 rounded-3xl border ${theme.border} bg-white/5 backdrop-blur-sm`}>
              <h3 className="text-sm font-black text-white flex items-center gap-3 mb-6 uppercase tracking-wider">
                <Box className={`w-5 h-5 ${theme.text}`} />
                {t.hardware}
              </h3>
              <div className="space-y-5">
                 <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>{t.cpuUsage}</span>
                      <span className={theme.text}>{isRunning ? (engine === EngineType.CPP ? '2.4%' : '8.1%') : '0%'}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                       <div className={`h-full ${theme.accent} transition-all duration-700`} style={{ width: isRunning ? (engine === EngineType.CPP ? '15%' : '40%') : '0%' }}></div>
                    </div>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">{t.volControl}</span>
                    <div className="flex items-center gap-3">
                       <Volume2 className="w-4 h-4 text-slate-600" />
                       <span className={`text-[10px] font-mono font-bold ${theme.text}`}>{Math.round(audioVolume * 100)}%</span>
                    </div>
                 </div>
                 <div className="pt-4 border-t border-white/5 flex gap-3">
                    <button className={`flex-1 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-[10px] font-black ${theme.text} flex items-center justify-center gap-2`}>
                      <Download className="w-3 h-3" /> {t.downloadSource}
                    </button>
                 </div>
              </div>
           </div>

           {/* 遥测日志 */}
           <div className={`flex-1 flex flex-col rounded-3xl border ${theme.border} bg-black/40 overflow-hidden`}>
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                 <h3 className="text-xs font-black text-white flex items-center gap-2 uppercase tracking-widest">
                   <Terminal className={`w-4 h-4 ${theme.text}`} />
                   {t.telemetry}
                 </h3>
                 <span className="text-[10px] mono text-slate-600 uppercase">SYS_LOG_V2.0</span>
              </div>
              <div className={`flex-1 overflow-y-auto p-5 space-y-3 font-mono text-[11px] leading-relaxed scrollbar-hide`}>
                {logs.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-40 italic">
                    <Activity className="w-8 h-8 mb-2" />
                    <p>WAITING_FOR_DATA_LINK...</p>
                  </div>
                )}
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="text-slate-600 shrink-0">[{log.timestamp.toLocaleTimeString([], { hour12: false })}]</span>
                    <div className="flex flex-col">
                      <span className={`font-bold ${
                        log.level === FatigueLevel.HEAVY ? 'text-rose-500' : 
                        log.level === FatigueLevel.MODERATE ? 'text-amber-500' : 'text-emerald-500'
                      }`}>
                        {log.engine}::{log.level}
                      </span>
                      <span className="text-slate-400 break-all">{log.message}</span>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </main>

      {/* 底部全宽警告栏 */}
      {isEmergency && (
        <div className="fixed bottom-0 inset-x-0 bg-rose-600 text-white py-6 px-12 z-[100] flex items-center justify-between animate-pulse">
           <div className="flex items-center gap-8">
              <AlertTriangle className="w-12 h-12" />
              <div>
                 <h2 className="text-2xl font-black uppercase tracking-tighter">{t.emergency}</h2>
                 <p className="text-rose-100 text-xs font-bold opacity-80 uppercase tracking-widest">Autonomous Driving Safety Override Active</p>
              </div>
           </div>
           <div className="px-8 py-3 bg-white text-rose-600 font-black rounded-full text-sm">EMERGENCY_STOP_CMD</div>
        </div>
      )}
    </div>
  );
};

export default App;
