
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, AlertTriangle, ShieldCheck, Activity, Volume2, Settings, List, Terminal, Download, Monitor } from 'lucide-react';
import { FatigueLevel, AnalysisResult, SystemLog } from './types';
import { analyzeDriverState, generateAlertAudio } from './services/geminiService';
import StatCard from './components/StatCard';

const App: React.FC = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [audioVolume, setAudioVolume] = useState(1.0);
  const [isEmergency, setIsEmergency] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysisTimerRef = useRef<number | null>(null);
  const lastAlertTimeRef = useRef<number>(0);

  const addLog = useCallback((level: FatigueLevel, message: string) => {
    setLogs(prev => [{ timestamp: new Date(), level, message }, ...prev].slice(0, 50));
  }, []);

  const playTTS = useCallback(async (text: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioBufferData = await generateAlertAudio(text);
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioBufferData);
      const source = audioContextRef.current.createBufferSource();
      const gainNode = audioContextRef.current.createGain();
      
      gainNode.gain.value = audioVolume;
      source.buffer = audioBuffer;
      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      source.start();
    } catch (err) {
      console.error("TTS Playback failed:", err);
    }
  }, [audioVolume]);

  const handleAnalysis = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isMonitoring) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      canvas.width = 640;
      canvas.height = 480;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

      try {
        const result = await analyzeDriverState(base64);
        setAnalysis(result);

        const now = Date.now();
        const alertCooldown = 15000;

        if (result.fatigueLevel === FatigueLevel.MODERATE) {
          setIsEmergency(false);
          setAudioVolume(0.8);
          if (now - lastAlertTimeRef.current > alertCooldown) {
            addLog(FatigueLevel.MODERATE, "检测到中度疲劳。播报预警。");
            playTTS("监测到您处于疲劳状态，建议您到下一个服务区休息。安全第一。");
            lastAlertTimeRef.current = now;
          }
        } else if (result.fatigueLevel === FatigueLevel.HEAVY) {
          setIsEmergency(true);
          setAudioVolume(0.2);
          if (now - lastAlertTimeRef.current > 5000) {
            addLog(FatigueLevel.HEAVY, "！！！检测到重度疲劳！！！触发紧急响应模式。");
            playTTS("警告！检测到严重疲劳！请立即靠边停车！警告！");
            lastAlertTimeRef.current = now;
          }
        } else {
          setIsEmergency(false);
          setAudioVolume(1.0);
          if (analysis?.fatigueLevel && analysis.fatigueLevel !== FatigueLevel.LOW) {
             addLog(FatigueLevel.LOW, "状态恢复正常。");
          }
        }
      } catch (err) {
        console.error("Analysis loop error:", err);
      }
    }
  }, [isMonitoring, playTTS, addLog, audioVolume, analysis?.fatigueLevel]);

  const toggleMonitoring = async () => {
    if (!isMonitoring) {
      setIsInitializing(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsMonitoring(true);
        addLog(FatigueLevel.LOW, "系统已启动，正在初始化实时监控...");
      } catch (err) {
        alert("无法访问摄像头。请确保权限已开启。");
      } finally {
        setIsInitializing(false);
      }
    } else {
      setIsMonitoring(false);
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      setIsEmergency(false);
      setAnalysis(null);
      addLog(FatigueLevel.LOW, "监控已停止。");
    }
  };

  useEffect(() => {
    if (isMonitoring) {
      analysisTimerRef.current = window.setInterval(handleAnalysis, 5000);
    } else {
      if (analysisTimerRef.current) clearInterval(analysisTimerRef.current);
    }
    return () => {
      if (analysisTimerRef.current) clearInterval(analysisTimerRef.current);
    };
  }, [isMonitoring, handleAnalysis]);

  const getStatusColor = (level: FatigueLevel | undefined) => {
    switch (level) {
      case FatigueLevel.HEAVY: return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      case FatigueLevel.MODERATE: return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      default: return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    }
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${isEmergency ? 'emergency-flash' : ''}`}>
      {/* Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">GuardDrive <span className="text-indigo-400">AI</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-2 ${getStatusColor(analysis?.fatigueLevel)}`}>
            <Activity className="w-3 h-3" />
            {isMonitoring ? (analysis?.fatigueLevel || 'SCANNING...') : 'STANDBY'}
          </div>
          <button 
            onClick={toggleMonitoring}
            disabled={isInitializing}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-all ${
              isMonitoring 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/30' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20'
            }`}
          >
            {isInitializing ? 'INITIALIZING...' : isMonitoring ? 'STOP SYSTEM' : 'START SYSTEM'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row p-6 gap-6 overflow-hidden">
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl group">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            <canvas ref={canvasRef} className="hidden" />
            
            {!isMonitoring && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-slate-400 p-8 text-center">
                <Camera className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-medium text-white">Live Monitoring Inactive</p>
                <p className="text-sm opacity-60 max-w-xs mt-2">Initialize the monitoring system to start real-time driver state analysis.</p>
              </div>
            )}

            {isMonitoring && (
              <>
                <div className="absolute top-4 left-4 p-4 rounded-xl bg-slate-950/60 backdrop-blur-sm border border-slate-700/50 pointer-events-none">
                   <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] mono text-red-400 font-bold tracking-widest uppercase">Live Monitoring</span>
                   </div>
                   <p className="text-[10px] mono text-slate-400 uppercase tracking-tighter">System ID: GD-0925-FLX</p>
                </div>
                
                {analysis && (
                  <div className="absolute bottom-4 right-4 p-4 rounded-xl bg-slate-950/60 backdrop-blur-sm border border-slate-700/50 max-w-xs transition-opacity duration-300">
                    <h4 className="text-[10px] font-bold text-indigo-400 uppercase mb-2 tracking-widest">AI Observation</h4>
                    <p className="text-xs text-slate-200 italic leading-relaxed">"{analysis.reasoning}"</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <StatCard label="Blink Rate" value={analysis?.blinkRate || '--'} unit="BPM" icon={<Activity className="w-4 h-4" />} status={analysis?.blinkRate && analysis.blinkRate < 10 ? 'warning' : 'normal'} />
             <StatCard label="Head Tilt" value={analysis?.headAngle || '--'} unit="DEG" icon={<Settings className="w-4 h-4" />} status={analysis?.headAngle && analysis.headAngle > 20 ? 'warning' : 'normal'} />
             <StatCard label="Eye Status" value={analysis?.eyeStatus || '--'} icon={<Camera className="w-4 h-4" />} status={analysis?.eyeStatus === 'DROOPY' ? 'warning' : analysis?.eyeStatus === 'CLOSED' ? 'danger' : 'normal'} />
             <StatCard label="Confidence" value={analysis ? Math.round(analysis.confidence * 100) : '--'} unit="%" icon={<Terminal className="w-4 h-4" />} />
          </div>
        </div>

        <div className="w-full lg:w-96 flex flex-col gap-6 overflow-hidden">
           {/* Desktop App Promo */}
           <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                 <Monitor className="w-5 h-5 text-indigo-400" />
                 <h3 className="font-bold text-sm">Windows Desktop Version</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                For higher performance and direct vehicle hardware control, use the standalone Python or C++ editions.
              </p>
              <div className="flex gap-2">
                 <button className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold py-2 rounded-lg transition-colors">
                   <Download className="w-3 h-3" /> PYTHON SOURCE
                 </button>
                 <button className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold py-2 rounded-lg transition-colors">
                   <Download className="w-3 h-3" /> C++ SOURCE
                 </button>
              </div>
           </div>

           <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2 text-sm">
                  <Settings className="w-4 h-4 text-indigo-400" />
                  System Controller
                </h3>
              </div>
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Music Volume (Auto)</span>
                    <div className="flex items-center gap-2">
                       <Volume2 className="w-4 h-4 text-slate-500" />
                       <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${audioVolume * 100}%` }} />
                       </div>
                    </div>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Warning Lights</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isEmergency ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-500'}`}>
                      {isEmergency ? 'FLASHING' : 'IDLE'}
                    </span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Yawn Detection</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${analysis?.yawnDetected ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 text-slate-500'}`}>
                      {analysis?.yawnDetected ? 'DETECTED' : 'CLEAR'}
                    </span>
                 </div>
              </div>
           </div>

           <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col overflow-hidden min-h-[250px]">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
                <h3 className="font-bold flex items-center gap-2 text-sm">
                  <List className="w-4 h-4 text-indigo-400" />
                  Telemetry Log
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                {logs.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center opacity-30 text-center p-4">
                      <Terminal className="w-8 h-8 mb-2" />
                      <p className="text-xs">Waiting for system telemetrics...</p>
                   </div>
                )}
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <span className="mono text-slate-600 whitespace-nowrap">{log.timestamp.toLocaleTimeString([], { hour12: false })}</span>
                    <div className="flex flex-col">
                      <span className={`font-bold tracking-tight mb-0.5 ${
                        log.level === FatigueLevel.HEAVY ? 'text-rose-500' : 
                        log.level === FatigueLevel.MODERATE ? 'text-amber-500' : 'text-emerald-500'
                      }`}>
                        [{log.level}]
                      </span>
                      <span className="text-slate-400 leading-tight">{log.message}</span>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </main>

      {isEmergency && (
        <div className="fixed inset-x-0 bottom-0 bg-rose-600 text-white p-4 text-center font-bold text-lg animate-bounce flex items-center justify-center gap-4 z-50">
          <AlertTriangle className="w-8 h-8" />
          DETECTION: CRITICAL FATIGUE - PULL OVER IMMEDIATELY
          <AlertTriangle className="w-8 h-8" />
        </div>
      )}
    </div>
  );
};

export default App;
