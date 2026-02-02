import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FocusSession {
  id: string;
  duration_minutes: number;
  focus_type: string;
  completed_at: string;
  is_completed: boolean;
}

const PRESETS = {
  pomodoro: { focus: 25, shortBreak: 5, longBreak: 15 },
  deepWork: { focus: 52, shortBreak: 17, longBreak: 30 },
  sprint: { focus: 15, shortBreak: 3, longBreak: 10 },
  custom: { focus: 30, shortBreak: 5, longBreak: 15 },
};

type PresetKey = keyof typeof PRESETS;
type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

interface TimerState {
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
  
  // Stopwatch
  stopwatchTime: number;
  isStopwatchRunning: boolean;
  stopwatchLaps: number[];
  
  // Alarm
  isAlarmRinging: boolean;
  
  // Today's sessions
  todaySessions: FocusSession[];
}

interface TimerContextType extends TimerState {
  settings: typeof PRESETS.pomodoro;
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
  
  // Stopwatch
  toggleStopwatch: () => void;
  resetStopwatch: () => void;
  addLap: () => void;
  saveStopwatchSession: () => Promise<void>;
  
  // Alarm
  stopAlarm: () => void;
  
  // Computed
  todayFocusMinutes: number;
  goalProgress: number;
  formatTime: (seconds: number) => string;
  formatStopwatchTime: (ms: number) => string;
}

const TimerContext = createContext<TimerContextType | null>(null);

const TIMER_STATE_KEY = 'glow_timer_context_state';
const STOPWATCH_STATE_KEY = 'glow_stopwatch_context_state';

// Create alarm sound that can be stopped
let alarmAudioContext: AudioContext | null = null;
let alarmOscillator: OscillatorNode | null = null;
let alarmGainNode: GainNode | null = null;
let alarmInterval: NodeJS.Timeout | null = null;

const createAlarmSound = () => {
  try {
    if (!alarmAudioContext) {
      alarmAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const oscillator = alarmAudioContext.createOscillator();
    const gainNode = alarmAudioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(alarmAudioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, alarmAudioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, alarmAudioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, alarmAudioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.3, alarmAudioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, alarmAudioContext.currentTime + 0.5);
    
    oscillator.start(alarmAudioContext.currentTime);
    oscillator.stop(alarmAudioContext.currentTime + 0.5);
  } catch (e) {
    console.log('Audio not available');
  }
};

const startContinuousAlarm = () => {
  // Play immediately and then every 1.5 seconds
  createAlarmSound();
  alarmInterval = setInterval(() => {
    createAlarmSound();
  }, 1500);
};

const stopContinuousAlarm = () => {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
  if (alarmOscillator) {
    try {
      alarmOscillator.stop();
    } catch (e) {}
    alarmOscillator = null;
  }
  if (alarmGainNode) {
    alarmGainNode = null;
  }
};

export function TimerProvider({ children }: { children: ReactNode }) {
  // Timer state
  const [mode, setModeState] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [preset, setPresetState] = useState<PresetKey>('pomodoro');
  const [customSettings, setCustomSettings] = useState(PRESETS.pomodoro);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(8);
  const [todaySessions, setTodaySessions] = useState<FocusSession[]>([]);
  
  // Stopwatch state
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [stopwatchLaps, setStopwatchLaps] = useState<number[]>([]);
  
  // Alarm state
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);
  
  // Refs for stopwatch
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const hasRestoredRef = useRef(false);
  
  const settings = preset === 'custom' ? customSettings : PRESETS[preset];
  
  // Wake lock
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.log('Wake Lock request failed');
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);
  
  // Load today's sessions
  const loadTodaySessions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('completed_at', `${today}T00:00:00`)
      .order('completed_at', { ascending: false });
    
    if (data) {
      setTodaySessions(data.filter(s => s.is_completed) as FocusSession[]);
      setSessionsCompleted(data.filter(s => s.focus_type === 'focus' && s.is_completed).length);
    }
  }, []);
  
  // Save timer state
  const saveTimerState = useCallback(() => {
    const state = {
      mode,
      timeLeft,
      isRunning,
      preset,
      customSettings,
      soundEnabled,
      autoSave,
      dailyGoal,
      savedAt: Date.now(),
    };
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
  }, [mode, timeLeft, isRunning, preset, customSettings, soundEnabled, autoSave, dailyGoal]);
  
  // Save stopwatch state
  const saveStopwatchState = useCallback(() => {
    const state = {
      stopwatchTime: isStopwatchRunning ? stopwatchTime : pausedTimeRef.current,
      isStopwatchRunning,
      startTime: startTimeRef.current,
      pausedTime: pausedTimeRef.current,
      laps: stopwatchLaps,
      savedAt: Date.now(),
    };
    localStorage.setItem(STOPWATCH_STATE_KEY, JSON.stringify(state));
  }, [isStopwatchRunning, stopwatchTime, stopwatchLaps]);
  
  // Restore states on mount
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    
    // Restore timer state
    const timerState = localStorage.getItem(TIMER_STATE_KEY);
    if (timerState) {
      try {
        const state = JSON.parse(timerState);
        setModeState(state.mode || 'focus');
        setPresetState(state.preset || 'pomodoro');
        if (state.customSettings) setCustomSettings(state.customSettings);
        setSoundEnabled(state.soundEnabled ?? true);
        setAutoSave(state.autoSave ?? true);
        setDailyGoal(state.dailyGoal || 8);
        
        if (state.isRunning && state.savedAt) {
          const elapsed = Math.floor((Date.now() - state.savedAt) / 1000);
          const remaining = Math.max(0, state.timeLeft - elapsed);
          
          if (remaining > 0) {
            setTimeLeft(remaining);
            setIsRunning(true);
            requestWakeLock();
          } else {
            // Timer completed while away - trigger alarm
            setTimeLeft(0);
            setIsAlarmRinging(true);
            if (state.soundEnabled !== false) {
              startContinuousAlarm();
            }
            toast.success('Timer completed!');
          }
        } else {
          setTimeLeft(state.timeLeft || 25 * 60);
        }
      } catch (e) {
        localStorage.removeItem(TIMER_STATE_KEY);
      }
    }
    
    // Restore stopwatch state
    const stopwatchState = localStorage.getItem(STOPWATCH_STATE_KEY);
    if (stopwatchState) {
      try {
        const state = JSON.parse(stopwatchState);
        setStopwatchLaps(state.laps || []);
        
        if (state.isStopwatchRunning && state.startTime) {
          const elapsed = Date.now() - state.savedAt;
          const totalElapsed = state.stopwatchTime + elapsed;
          startTimeRef.current = Date.now();
          pausedTimeRef.current = totalElapsed;
          setStopwatchTime(totalElapsed);
          setIsStopwatchRunning(true);
          requestWakeLock();
        } else {
          setStopwatchTime(state.stopwatchTime || 0);
          pausedTimeRef.current = state.stopwatchTime || 0;
        }
      } catch (e) {
        localStorage.removeItem(STOPWATCH_STATE_KEY);
      }
    }
    
    loadTodaySessions();
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    return () => {
      releaseWakeLock();
      stopContinuousAlarm();
    };
  }, [requestWakeLock, releaseWakeLock, loadTodaySessions]);
  
  // Save state on every change
  useEffect(() => {
    if (hasRestoredRef.current) {
      saveTimerState();
    }
  }, [saveTimerState]);
  
  useEffect(() => {
    if (hasRestoredRef.current) {
      saveStopwatchState();
    }
  }, [saveStopwatchState]);
  
  // Timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isRunning]);
  
  // Stopwatch effect
  useEffect(() => {
    let animationFrame: number;
    
    const updateStopwatch = () => {
      if (isStopwatchRunning && startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current + pausedTimeRef.current;
        setStopwatchTime(elapsed);
        animationFrame = requestAnimationFrame(updateStopwatch);
      }
    };
    
    if (isStopwatchRunning) {
      animationFrame = requestAnimationFrame(updateStopwatch);
    }
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isStopwatchRunning]);
  
  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveTimerState();
        saveStopwatchState();
      } else {
        // Recalculate timer when coming back
        const timerState = localStorage.getItem(TIMER_STATE_KEY);
        if (timerState && isRunning) {
          const state = JSON.parse(timerState);
          const elapsed = Math.floor((Date.now() - state.savedAt) / 1000);
          const remaining = Math.max(0, state.timeLeft - elapsed);
          
          if (remaining === 0 && !isAlarmRinging) {
            handleSessionComplete();
          } else {
            setTimeLeft(remaining);
          }
        }
        
        // Recalculate stopwatch
        if (isStopwatchRunning && startTimeRef.current) {
          const elapsed = Date.now() - startTimeRef.current + pausedTimeRef.current;
          setStopwatchTime(elapsed);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRunning, isStopwatchRunning, isAlarmRinging, saveTimerState, saveStopwatchState]);
  
  const handleSessionComplete = useCallback(async () => {
    setIsRunning(false);
    setIsAlarmRinging(true);
    
    if (soundEnabled) {
      startContinuousAlarm();
    }
    
    // Show notification if page is in background
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Timer Complete!', {
        body: mode === 'focus' ? 'Great work! Take a break.' : 'Break over! Ready to focus?',
        icon: '/favicon.ico',
        tag: 'timer-complete'
      });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user && autoSave) {
      const duration = mode === 'focus' 
        ? settings.focus 
        : mode === 'shortBreak' 
        ? settings.shortBreak 
        : settings.longBreak;

      await supabase.from('focus_sessions').insert({
        user_id: user.id,
        duration_minutes: duration,
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
    
    // Move to next mode
    if (mode === 'focus') {
      if (sessionsCompleted % 4 === 0) {
        setModeState('longBreak');
      } else {
        setModeState('shortBreak');
      }
    } else {
      setModeState('focus');
    }
    
    // Reset timer for next mode
    const nextSettings = preset === 'custom' ? customSettings : PRESETS[preset];
    const nextMode = mode === 'focus' 
      ? (sessionsCompleted % 4 === 0 ? 'longBreak' : 'shortBreak')
      : 'focus';
    const nextDuration = nextMode === 'focus' 
      ? nextSettings.focus 
      : nextMode === 'shortBreak' 
      ? nextSettings.shortBreak 
      : nextSettings.longBreak;
    setTimeLeft(nextDuration * 60);
  }, [mode, sessionsCompleted, preset, customSettings, releaseWakeLock]);

  const toggleTimer = useCallback(() => {
    if (isAlarmRinging) {
      stopAlarm();
      return;
    }
    
    if (!isRunning) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    setIsRunning(prev => !prev);
  }, [isRunning, isAlarmRinging, stopAlarm, requestWakeLock, releaseWakeLock]);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setIsAlarmRinging(false);
    stopContinuousAlarm();
    releaseWakeLock();
    const duration = mode === 'focus' 
      ? settings.focus 
      : mode === 'shortBreak' 
      ? settings.shortBreak 
      : settings.longBreak;
    setTimeLeft(duration * 60);
  }, [mode, settings, releaseWakeLock]);

  const skipToNext = useCallback(() => {
    if (mode === 'focus') {
      setModeState(sessionsCompleted % 4 === 3 ? 'longBreak' : 'shortBreak');
    } else {
      setModeState('focus');
    }
    setIsRunning(false);
    setIsAlarmRinging(false);
    stopContinuousAlarm();
    releaseWakeLock();
  }, [mode, sessionsCompleted, releaseWakeLock]);

  const adjustTime = useCallback((minutes: number) => {
    setTimeLeft(prev => Math.max(60, prev + minutes * 60));
  }, []);

  const manualSaveSession = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in to save sessions');
      return;
    }

    const totalDuration = mode === 'focus' 
      ? settings.focus * 60 
      : mode === 'shortBreak' 
      ? settings.shortBreak * 60 
      : settings.longBreak * 60;
    
    const elapsedMinutes = Math.round((totalDuration - timeLeft) / 60);
    
    if (elapsedMinutes < 1) {
      toast.error('Complete at least 1 minute before saving');
      return;
    }

    await supabase.from('focus_sessions').insert({
      user_id: user.id,
      duration_minutes: elapsedMinutes,
      focus_type: mode === 'focus' ? 'focus' : mode === 'shortBreak' ? 'short_break' : 'long_break',
      is_completed: true,
    });

    loadTodaySessions();
    toast.success(`Saved ${elapsedMinutes} minute session!`);
  }, [mode, settings, timeLeft, loadTodaySessions]);

  const setMode = useCallback((newMode: TimerMode) => {
    if (isAlarmRinging) {
      stopAlarm();
    }
    setModeState(newMode);
    setIsRunning(false);
    releaseWakeLock();
    const nextSettings = preset === 'custom' ? customSettings : PRESETS[preset];
    const duration = newMode === 'focus' 
      ? nextSettings.focus 
      : newMode === 'shortBreak' 
      ? nextSettings.shortBreak 
      : nextSettings.longBreak;
    setTimeLeft(duration * 60);
  }, [preset, customSettings, isAlarmRinging, stopAlarm, releaseWakeLock]);

  const setPreset = useCallback((newPreset: PresetKey) => {
    setPresetState(newPreset);
    if (!isRunning) {
      const nextSettings = newPreset === 'custom' ? customSettings : PRESETS[newPreset];
      const duration = mode === 'focus' 
        ? nextSettings.focus 
        : mode === 'shortBreak' 
        ? nextSettings.shortBreak 
        : nextSettings.longBreak;
      setTimeLeft(duration * 60);
    }
  }, [mode, customSettings, isRunning]);

  // Stopwatch controls
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

  const addLap = useCallback(() => {
    setStopwatchLaps(prev => [...prev, stopwatchTime]);
  }, [stopwatchTime]);

  const saveStopwatchSession = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in to save sessions');
      return;
    }

    const minutes = Math.round(stopwatchTime / 60000);
    if (minutes < 1) {
      toast.error('Complete at least 1 minute before saving');
      return;
    }

    await supabase.from('focus_sessions').insert({
      user_id: user.id,
      duration_minutes: minutes,
      focus_type: 'stopwatch',
      is_completed: true,
    });

    loadTodaySessions();
    toast.success(`Saved ${minutes} minute session!`);
  }, [stopwatchTime, loadTodaySessions]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatStopwatchTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  const todayFocusMinutes = todaySessions
    .filter(s => s.focus_type === 'focus' || s.focus_type === 'stopwatch')
    .reduce((sum, s) => sum + s.duration_minutes, 0);

  const goalProgress = Math.min(100, (sessionsCompleted / dailyGoal) * 100);

  return (
    <TimerContext.Provider value={{
      mode,
      timeLeft,
      isRunning,
      sessionsCompleted,
      preset,
      customSettings,
      soundEnabled,
      autoSave,
      dailyGoal,
      todaySessions,
      stopwatchTime,
      isStopwatchRunning,
      stopwatchLaps,
      isAlarmRinging,
      settings,
      toggleTimer,
      resetTimer,
      skipToNext,
      adjustTime,
      manualSaveSession,
      setMode,
      setPreset,
      setCustomSettings,
      setSoundEnabled,
      setAutoSave,
      setDailyGoal,
      toggleStopwatch,
      resetStopwatch,
      addLap,
      saveStopwatchSession,
      stopAlarm,
      todayFocusMinutes,
      goalProgress,
      formatTime,
      formatStopwatchTime,
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
}
