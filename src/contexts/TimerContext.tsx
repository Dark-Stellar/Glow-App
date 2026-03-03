import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FocusSession {
  id: string;
  duration_minutes: number;
  focus_type: string;
  completed_at: string;
  is_completed: boolean;
  started_at: string;
  task_title: string | null;
}

const PRESETS = {
  pomodoro: { focus: 25, shortBreak: 5, longBreak: 15 },
  deepWork: { focus: 52, shortBreak: 17, longBreak: 30 },
  sprint: { focus: 15, shortBreak: 3, longBreak: 10 },
  custom: { focus: 30, shortBreak: 5, longBreak: 15 },
};

type PresetKey = keyof typeof PRESETS;
type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

interface TimerContextType {
  // Timer
  mode: TimerMode;
  timeLeft: number;
  isRunning: boolean;
  sessionsCompleted: number;
  preset: PresetKey;
  customSettings: typeof PRESETS.pomodoro;
  soundEnabled: boolean;
  autoSave: boolean;
  dailyGoal: number;
  alarmVolume: number;
  
  // Stopwatch
  stopwatchTime: number;
  isStopwatchRunning: boolean;
  stopwatchLaps: number[];
  
  // Alarm
  isAlarmRinging: boolean;
  
  // Today's sessions
  todaySessions: FocusSession[];
  
  // Computed
  settings: typeof PRESETS.pomodoro;
  todayFocusMinutes: number;
  goalProgress: number;
  
  // Actions
  toggleTimer: () => void;
  resetTimer: () => void;
  skipToNext: () => void;
  adjustTime: (minutes: number) => void;
  manualSaveSession: () => Promise<void>;
  setMode: (mode: TimerMode) => void;
  setPreset: (preset: PresetKey) => void;
  setCustomSettings: (settings: typeof PRESETS.pomodoro) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setAutoSave: (autoSave: boolean) => void;
  setDailyGoal: (goal: number) => void;
  setAlarmVolume: (volume: number) => void;
  toggleStopwatch: () => void;
  resetStopwatch: () => void;
  addLap: () => void;
  saveStopwatchSession: () => Promise<void>;
  stopAlarm: () => void;
  loadTodaySessions: () => Promise<void>;
  formatTime: (seconds: number) => string;
  formatStopwatchTime: (ms: number) => string;
}

const TimerContext = createContext<TimerContextType | null>(null);

const TIMER_STATE_KEY = 'glow_timer_context_state';
const STOPWATCH_STATE_KEY = 'glow_stopwatch_context_state';
const ALARM_VOLUME_KEY = 'glow_alarm_volume';

// Alarm audio management
let alarmInterval: ReturnType<typeof setInterval> | null = null;
let currentVolume = 0.3;

const createGentleChime = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const t = ctx.currentTime;

    // Gentle chime: two soft harmonics with slow decay
    const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 - major chord
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);

      const startTime = t + i * 0.15;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(currentVolume * 0.4, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.2);

      osc.start(startTime);
      osc.stop(startTime + 1.3);
    });
  } catch {}
};

const startContinuousAlarm = () => {
  createGentleChime();
  alarmInterval = setInterval(createGentleChime, 2500);
};

const stopContinuousAlarm = () => {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
};

export function TimerProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [preset, setPresetState] = useState<PresetKey>('pomodoro');
  const [customSettings, setCustomSettings] = useState(PRESETS.pomodoro);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(8);
  const [alarmVolume, setAlarmVolumeState] = useState(() => {
    const saved = localStorage.getItem(ALARM_VOLUME_KEY);
    return saved ? parseFloat(saved) : 0.3;
  });
  const [todaySessions, setTodaySessions] = useState<FocusSession[]>([]);
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [stopwatchLaps, setStopwatchLaps] = useState<number[]>([]);
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);
  
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const hasRestoredRef = useRef(false);
  
  const settings = preset === 'custom' ? customSettings : PRESETS[preset];
  
  // Sync alarm volume
  const setAlarmVolume = useCallback((vol: number) => {
    setAlarmVolumeState(vol);
    currentVolume = vol;
    localStorage.setItem(ALARM_VOLUME_KEY, vol.toString());
  }, []);
  
  useEffect(() => { currentVolume = alarmVolume; }, [alarmVolume]);
  
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try { wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch {}
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);
  
  const loadTodaySessions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('started_at', `${today}T00:00:00`)
      .order('started_at', { ascending: false });
    
    if (data) {
      setTodaySessions(data as FocusSession[]);
      setSessionsCompleted(data.filter(s => s.focus_type === 'focus' && s.is_completed).length);
    }
  }, []);
  
  const saveTimerState = useCallback(() => {
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify({
      mode, timeLeft, isRunning, preset, customSettings, soundEnabled, autoSave, dailyGoal,
      savedAt: Date.now(),
    }));
  }, [mode, timeLeft, isRunning, preset, customSettings, soundEnabled, autoSave, dailyGoal]);
  
  const saveStopwatchState = useCallback(() => {
    localStorage.setItem(STOPWATCH_STATE_KEY, JSON.stringify({
      stopwatchTime: isStopwatchRunning ? stopwatchTime : pausedTimeRef.current,
      isStopwatchRunning, startTime: startTimeRef.current,
      pausedTime: pausedTimeRef.current, laps: stopwatchLaps,
      savedAt: Date.now(),
    }));
  }, [isStopwatchRunning, stopwatchTime, stopwatchLaps]);
  
  // Restore on mount
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    
    const timerState = localStorage.getItem(TIMER_STATE_KEY);
    if (timerState) {
      try {
        const s = JSON.parse(timerState);
        setModeState(s.mode || 'focus');
        setPresetState(s.preset || 'pomodoro');
        if (s.customSettings) setCustomSettings(s.customSettings);
        setSoundEnabled(s.soundEnabled ?? true);
        setAutoSave(s.autoSave ?? true);
        setDailyGoal(s.dailyGoal || 8);
        
        if (s.isRunning && s.savedAt) {
          const elapsed = Math.floor((Date.now() - s.savedAt) / 1000);
          const remaining = Math.max(0, s.timeLeft - elapsed);
          if (remaining > 0) {
            setTimeLeft(remaining);
            setIsRunning(true);
            requestWakeLock();
          } else {
            setTimeLeft(0);
            setIsAlarmRinging(true);
            if (s.soundEnabled !== false) startContinuousAlarm();
          }
        } else {
          setTimeLeft(s.timeLeft || 25 * 60);
        }
      } catch { localStorage.removeItem(TIMER_STATE_KEY); }
    }
    
    const stopwatchState = localStorage.getItem(STOPWATCH_STATE_KEY);
    if (stopwatchState) {
      try {
        const s = JSON.parse(stopwatchState);
        setStopwatchLaps(s.laps || []);
        if (s.isStopwatchRunning && s.startTime) {
          const totalElapsed = s.stopwatchTime + (Date.now() - s.savedAt);
          startTimeRef.current = Date.now();
          pausedTimeRef.current = totalElapsed;
          setStopwatchTime(totalElapsed);
          setIsStopwatchRunning(true);
          requestWakeLock();
        } else {
          setStopwatchTime(s.stopwatchTime || 0);
          pausedTimeRef.current = s.stopwatchTime || 0;
        }
      } catch { localStorage.removeItem(STOPWATCH_STATE_KEY); }
    }
    
    loadTodaySessions();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    return () => { releaseWakeLock(); stopContinuousAlarm(); };
  }, [requestWakeLock, releaseWakeLock, loadTodaySessions]);
  
  // Persist state
  useEffect(() => { if (hasRestoredRef.current) saveTimerState(); }, [saveTimerState]);
  useEffect(() => { if (hasRestoredRef.current) saveStopwatchState(); }, [saveStopwatchState]);
  
  // Timer countdown
  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleSessionComplete(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);
  
  // Stopwatch
  useEffect(() => {
    if (!isStopwatchRunning) return;
    let raf: number;
    const update = () => {
      if (startTimeRef.current) {
        setStopwatchTime(Date.now() - startTimeRef.current + pausedTimeRef.current);
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [isStopwatchRunning]);
  
  // Visibility change handler
  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        saveTimerState();
        saveStopwatchState();
      } else {
        if (isRunning) {
          const timerState = localStorage.getItem(TIMER_STATE_KEY);
          if (timerState) {
            const s = JSON.parse(timerState);
            const elapsed = Math.floor((Date.now() - s.savedAt) / 1000);
            const remaining = Math.max(0, s.timeLeft - elapsed);
            if (remaining === 0 && !isAlarmRinging) {
              handleSessionComplete();
            } else {
              setTimeLeft(remaining);
            }
          }
        }
        if (isStopwatchRunning && startTimeRef.current) {
          setStopwatchTime(Date.now() - startTimeRef.current + pausedTimeRef.current);
        }
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [isRunning, isStopwatchRunning, isAlarmRinging, saveTimerState, saveStopwatchState]);
  
  const handleSessionComplete = useCallback(async () => {
    setIsRunning(false);
    setIsAlarmRinging(true);
    if (soundEnabled) startContinuousAlarm();
    
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Timer Complete!', {
        body: mode === 'focus' ? 'Great work! Take a break.' : 'Break over! Ready to focus?',
        icon: '/favicon.ico', tag: 'timer-complete'
      });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user && autoSave) {
      const duration = mode === 'focus' ? settings.focus : mode === 'shortBreak' ? settings.shortBreak : settings.longBreak;
      await supabase.from('focus_sessions').insert({
        user_id: user.id, duration_minutes: duration,
        focus_type: mode === 'focus' ? 'focus' : mode === 'shortBreak' ? 'short_break' : 'long_break',
        is_completed: true,
      });
      loadTodaySessions();
    }

    if (mode === 'focus') {
      const newCount = sessionsCompleted + 1;
      setSessionsCompleted(newCount);
      toast.success(`🎉 Focus session complete! (${newCount} today)`);
    } else {
      toast.success("Break over! Ready to focus?");
    }
  }, [mode, settings, sessionsCompleted, autoSave, soundEnabled, loadTodaySessions]);
  
  const stopAlarm = useCallback(() => {
    setIsAlarmRinging(false);
    stopContinuousAlarm();
    releaseWakeLock();
    
    const nextMode = mode === 'focus'
      ? (sessionsCompleted % 4 === 0 ? 'longBreak' : 'shortBreak')
      : 'focus';
    setModeState(nextMode);
    
    const nextSettings = preset === 'custom' ? customSettings : PRESETS[preset];
    const nextDuration = nextMode === 'focus' ? nextSettings.focus : nextMode === 'shortBreak' ? nextSettings.shortBreak : nextSettings.longBreak;
    setTimeLeft(nextDuration * 60);
  }, [mode, sessionsCompleted, preset, customSettings, releaseWakeLock]);

  const toggleTimer = useCallback(() => {
    if (isAlarmRinging) { stopAlarm(); return; }
    if (!isRunning) requestWakeLock(); else releaseWakeLock();
    setIsRunning(prev => !prev);
  }, [isRunning, isAlarmRinging, stopAlarm, requestWakeLock, releaseWakeLock]);

  const resetTimer = useCallback(() => {
    setIsRunning(false); setIsAlarmRinging(false);
    stopContinuousAlarm(); releaseWakeLock();
    const duration = mode === 'focus' ? settings.focus : mode === 'shortBreak' ? settings.shortBreak : settings.longBreak;
    setTimeLeft(duration * 60);
  }, [mode, settings, releaseWakeLock]);

  const skipToNext = useCallback(() => {
    setModeState(mode === 'focus' ? (sessionsCompleted % 4 === 3 ? 'longBreak' : 'shortBreak') : 'focus');
    setIsRunning(false); setIsAlarmRinging(false);
    stopContinuousAlarm(); releaseWakeLock();
  }, [mode, sessionsCompleted, releaseWakeLock]);

  const adjustTime = useCallback((minutes: number) => {
    setTimeLeft(prev => Math.max(60, prev + minutes * 60));
  }, []);

  const manualSaveSession = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Please sign in'); return; }

    const totalDuration = mode === 'focus' ? settings.focus * 60 : mode === 'shortBreak' ? settings.shortBreak * 60 : settings.longBreak * 60;
    const elapsedMinutes = Math.round((totalDuration - timeLeft) / 60);
    if (elapsedMinutes < 1) { toast.error('Complete at least 1 minute'); return; }

    await supabase.from('focus_sessions').insert({
      user_id: user.id, duration_minutes: elapsedMinutes,
      focus_type: mode === 'focus' ? 'focus' : mode === 'shortBreak' ? 'short_break' : 'long_break',
      is_completed: true,
    });
    loadTodaySessions();
    toast.success(`Saved ${elapsedMinutes} minute session!`);
  }, [mode, settings, timeLeft, loadTodaySessions]);

  const setMode = useCallback((newMode: TimerMode) => {
    if (isAlarmRinging) stopAlarm();
    setModeState(newMode);
    setIsRunning(false); releaseWakeLock();
    const ns = preset === 'custom' ? customSettings : PRESETS[preset];
    setTimeLeft((newMode === 'focus' ? ns.focus : newMode === 'shortBreak' ? ns.shortBreak : ns.longBreak) * 60);
  }, [preset, customSettings, isAlarmRinging, stopAlarm, releaseWakeLock]);

  const setPreset = useCallback((newPreset: PresetKey) => {
    setPresetState(newPreset);
    if (!isRunning) {
      const ns = newPreset === 'custom' ? customSettings : PRESETS[newPreset];
      setTimeLeft((mode === 'focus' ? ns.focus : mode === 'shortBreak' ? ns.shortBreak : ns.longBreak) * 60);
    }
  }, [mode, customSettings, isRunning]);

  const toggleStopwatch = useCallback(() => {
    if (!isStopwatchRunning) {
      startTimeRef.current = Date.now();
      setIsStopwatchRunning(true);
      requestWakeLock();
    } else {
      pausedTimeRef.current = stopwatchTime;
      startTimeRef.current = null;
      setIsStopwatchRunning(false);
      releaseWakeLock();
    }
  }, [isStopwatchRunning, stopwatchTime, requestWakeLock, releaseWakeLock]);

  const resetStopwatch = useCallback(() => {
    setIsStopwatchRunning(false);
    setStopwatchTime(0);
    setStopwatchLaps([]);
    startTimeRef.current = null;
    pausedTimeRef.current = 0;
    releaseWakeLock();
    localStorage.removeItem(STOPWATCH_STATE_KEY);
  }, [releaseWakeLock]);

  const addLap = useCallback(() => setStopwatchLaps(prev => [...prev, stopwatchTime]), [stopwatchTime]);

  const saveStopwatchSession = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Please sign in'); return; }
    const minutes = Math.round(stopwatchTime / 60000);
    if (minutes < 1) { toast.error('Complete at least 1 minute'); return; }

    await supabase.from('focus_sessions').insert({
      user_id: user.id, duration_minutes: minutes,
      focus_type: 'stopwatch', is_completed: true,
    });
    loadTodaySessions();
    toast.success(`Saved ${minutes} minute session!`);
  }, [stopwatchTime, loadTodaySessions]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatStopwatchTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const cs = Math.floor((ms % 1000) / 10);
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
  };

  const todayFocusMinutes = todaySessions
    .filter(s => (s.focus_type === 'focus' || s.focus_type === 'stopwatch') && s.is_completed)
    .reduce((sum, s) => sum + s.duration_minutes, 0);

  const goalProgress = Math.min(100, (sessionsCompleted / dailyGoal) * 100);

  return (
    <TimerContext.Provider value={{
      mode, timeLeft, isRunning, sessionsCompleted, preset, customSettings,
      soundEnabled, autoSave, dailyGoal, alarmVolume, todaySessions,
      stopwatchTime, isStopwatchRunning, stopwatchLaps, isAlarmRinging,
      settings, todayFocusMinutes, goalProgress,
      toggleTimer, resetTimer, skipToNext, adjustTime, manualSaveSession,
      setMode, setPreset, setCustomSettings, setSoundEnabled, setAutoSave,
      setDailyGoal, setAlarmVolume, toggleStopwatch, resetStopwatch, addLap,
      saveStopwatchSession, stopAlarm, loadTodaySessions, formatTime, formatStopwatchTime,
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (!context) throw new Error('useTimer must be used within a TimerProvider');
  return context;
}
