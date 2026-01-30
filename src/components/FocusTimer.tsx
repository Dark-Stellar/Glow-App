import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Play, Pause, RotateCcw, SkipForward, Settings, Coffee, Brain,
  Volume2, VolumeX, Flame, Target, Trophy, Timer, Save,
  Plus, Minus, Clock, Watch
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

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

// Timer completion sound - pleasant chime
const TIMER_COMPLETE_SOUND = "data:audio/wav;base64,UklGRl9vT19teleT8LEgiRIV1hPQ0ozcxphY29kZVBST0NFTQ//UElORyBsaWJjbHQgMi40LjQ=";

// Generate a proper notification sound
const createTimerSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
  
  return audioContext;
};

export function FocusTimer() {
  // Timer mode
  const [timerMode, setTimerMode] = useState<'timer' | 'stopwatch'>('timer');
  
  // Timer state
  const [mode, setMode] = useState<'focus' | 'shortBreak' | 'longBreak'>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [todaySessions, setTodaySessions] = useState<FocusSession[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [preset, setPreset] = useState<keyof typeof PRESETS>('pomodoro');
  const [customSettings, setCustomSettings] = useState(PRESETS.pomodoro);
  const [showSettings, setShowSettings] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(8);
  const [autoSave, setAutoSave] = useState(true);
  
  // Stopwatch state
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [stopwatchLaps, setStopwatchLaps] = useState<number[]>([]);
  
  // Wake lock for keeping screen on
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const timerWorkerRef = useRef<Worker | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0);
  
  // Background timer using localStorage for persistence
  const backgroundTimerKey = 'glow_focus_timer_state';
  const backgroundStopwatchKey = 'glow_stopwatch_state';
  
  const settings = useMemo(() => 
    preset === 'custom' ? customSettings : PRESETS[preset]
  , [preset, customSettings]);

  // Request wake lock to keep screen on
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          console.log('Wake Lock released');
        });
      } catch (err) {
        console.log('Wake Lock request failed');
      }
    }
  }, []);

  // Release wake lock
  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  // Play completion sound
  const playCompletionSound = useCallback(() => {
    if (!soundEnabled) return;
    
    try {
      createTimerSound();
      
      // Also try to play a second chime after a short delay
      setTimeout(() => {
        try {
          createTimerSound();
        } catch (e) {
          // Ignore
        }
      }, 600);
      
      // Show notification if page is in background
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Timer Complete!', {
          body: mode === 'focus' ? 'Great work! Take a break.' : 'Break over! Ready to focus?',
          icon: '/favicon.ico',
          tag: 'timer-complete'
        });
      }
    } catch (e) {
      // Audio not available
    }
  }, [soundEnabled, mode]);

  // Save timer state to localStorage for background persistence
  const saveTimerState = useCallback(() => {
    if (isRunning) {
      const state = {
        timeLeft,
        mode,
        isRunning: true,
        savedAt: Date.now(),
        preset,
        customSettings
      };
      localStorage.setItem(backgroundTimerKey, JSON.stringify(state));
    } else {
      localStorage.removeItem(backgroundTimerKey);
    }
  }, [isRunning, timeLeft, mode, preset, customSettings]);

  // Save stopwatch state
  const saveStopwatchState = useCallback(() => {
    if (isStopwatchRunning) {
      const state = {
        startTime: startTimeRef.current,
        pausedTime: pausedTimeRef.current,
        isRunning: true,
        savedAt: Date.now(),
        laps: stopwatchLaps
      };
      localStorage.setItem(backgroundStopwatchKey, JSON.stringify(state));
    } else {
      const state = {
        pausedTime: stopwatchTime,
        isRunning: false,
        laps: stopwatchLaps
      };
      localStorage.setItem(backgroundStopwatchKey, JSON.stringify(state));
    }
  }, [isStopwatchRunning, stopwatchTime, stopwatchLaps]);

  // Restore timer state from localStorage
  const restoreTimerState = useCallback(() => {
    const savedState = localStorage.getItem(backgroundTimerKey);
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        const elapsed = Math.floor((Date.now() - state.savedAt) / 1000);
        const remainingTime = Math.max(0, state.timeLeft - elapsed);
        
        if (remainingTime > 0) {
          setTimeLeft(remainingTime);
          setMode(state.mode);
          setPreset(state.preset);
          if (state.customSettings) setCustomSettings(state.customSettings);
          setIsRunning(true);
          requestWakeLock();
        } else {
          // Timer completed while away
          localStorage.removeItem(backgroundTimerKey);
          playCompletionSound();
          toast.success('Timer completed while you were away!');
        }
      } catch (e) {
        localStorage.removeItem(backgroundTimerKey);
      }
    }
  }, [requestWakeLock, playCompletionSound]);

  // Restore stopwatch state
  const restoreStopwatchState = useCallback(() => {
    const savedState = localStorage.getItem(backgroundStopwatchKey);
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        setStopwatchLaps(state.laps || []);
        
        if (state.isRunning && state.startTime) {
          startTimeRef.current = state.startTime;
          pausedTimeRef.current = state.pausedTime || 0;
          setIsStopwatchRunning(true);
          requestWakeLock();
        } else {
          setStopwatchTime(state.pausedTime || 0);
          pausedTimeRef.current = state.pausedTime || 0;
        }
      } catch (e) {
        localStorage.removeItem(backgroundStopwatchKey);
      }
    }
  }, [requestWakeLock]);

  // Load data on mount
  useEffect(() => {
    loadTodaySessions();
    restoreTimerState();
    restoreStopwatchState();
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    return () => {
      releaseWakeLock();
    };
  }, []);

  // Save state when visibility changes (for background operation)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveTimerState();
        saveStopwatchState();
      } else {
        // When coming back to foreground, recalculate time
        if (isRunning) {
          const savedState = localStorage.getItem(backgroundTimerKey);
          if (savedState) {
            const state = JSON.parse(savedState);
            const elapsed = Math.floor((Date.now() - state.savedAt) / 1000);
            const remainingTime = Math.max(0, state.timeLeft - elapsed);
            
            if (remainingTime === 0) {
              handleSessionComplete();
            } else {
              setTimeLeft(remainingTime);
            }
          }
        }
        
        if (isStopwatchRunning && startTimeRef.current) {
          const elapsed = Date.now() - startTimeRef.current + pausedTimeRef.current;
          setStopwatchTime(elapsed);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRunning, isStopwatchRunning, saveTimerState, saveStopwatchState]);

  // Update time when mode changes (only if not running)
  useEffect(() => {
    if (!isRunning) {
      const duration = mode === 'focus' 
        ? settings.focus 
        : mode === 'shortBreak' 
        ? settings.shortBreak 
        : settings.longBreak;
      setTimeLeft(duration * 60);
    }
  }, [mode, settings, isRunning]);

  // Timer countdown effect
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

  const handleSessionComplete = useCallback(async () => {
    setIsRunning(false);
    releaseWakeLock();
    localStorage.removeItem(backgroundTimerKey);
    
    playCompletionSound();

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
      
      if (newCount % 4 === 0) {
        setMode('longBreak');
        toast.info("Take a longer break - you've earned it!");
      } else {
        setMode('shortBreak');
      }
    } else {
      toast.success("Break over! Ready to focus?");
      setMode('focus');
    }
  }, [mode, settings, sessionsCompleted, autoSave, loadTodaySessions, playCompletionSound, releaseWakeLock]);

  const toggleTimer = useCallback(() => {
    if (!isRunning) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    setIsRunning(prev => !prev);
  }, [isRunning, requestWakeLock, releaseWakeLock]);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    releaseWakeLock();
    localStorage.removeItem(backgroundTimerKey);
    const duration = mode === 'focus' 
      ? settings.focus 
      : mode === 'shortBreak' 
      ? settings.shortBreak 
      : settings.longBreak;
    setTimeLeft(duration * 60);
  }, [mode, settings, releaseWakeLock]);

  const skipToNext = useCallback(() => {
    if (mode === 'focus') {
      setMode(sessionsCompleted % 4 === 3 ? 'longBreak' : 'shortBreak');
    } else {
      setMode('focus');
    }
    setIsRunning(false);
    releaseWakeLock();
    localStorage.removeItem(backgroundTimerKey);
  }, [mode, sessionsCompleted, releaseWakeLock]);

  // Adjust time while timer is running or stopped
  const adjustTime = useCallback((minutes: number) => {
    setTimeLeft(prev => Math.max(60, prev + minutes * 60)); // Minimum 1 minute
  }, []);

  // Manual save session
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
    localStorage.removeItem(backgroundStopwatchKey);
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

  const totalDuration = mode === 'focus' 
    ? settings.focus * 60 
    : mode === 'shortBreak' 
    ? settings.shortBreak * 60 
    : settings.longBreak * 60;
  
  const progress = ((totalDuration - timeLeft) / totalDuration) * 100;

  const todayFocusMinutes = useMemo(() => 
    todaySessions
      .filter(s => s.focus_type === 'focus' || s.focus_type === 'stopwatch')
      .reduce((sum, s) => sum + s.duration_minutes, 0)
  , [todaySessions]);

  const goalProgress = Math.min(100, (sessionsCompleted / dailyGoal) * 100);

  const getModeColor = () => {
    switch (mode) {
      case 'focus': return 'from-primary to-primary/80';
      case 'shortBreak': return 'from-success to-success/80';
      case 'longBreak': return 'from-info to-info/80';
    }
  };

  return (
    <Card className="p-6 relative overflow-hidden">
      {/* Background glow */}
      <div 
        className={cn(
          "absolute inset-0 opacity-10 transition-all duration-500 bg-gradient-to-br",
          timerMode === 'timer' ? getModeColor() : "from-accent to-accent/80"
        )}
      />
      
      <div className="relative z-10">
        {/* Header with mode switcher */}
        <div className="flex items-center justify-between mb-4">
          <Tabs value={timerMode} onValueChange={(v) => setTimerMode(v as typeof timerMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="timer" className="text-xs px-3">
                <Timer className="h-3.5 w-3.5 mr-1" />
                Timer
              </TabsTrigger>
              <TabsTrigger value="stopwatch" className="text-xs px-3">
                <Watch className="h-3.5 w-3.5 mr-1" />
                Stopwatch
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Timer Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Auto-save completed sessions</label>
                    <Switch checked={autoSave} onCheckedChange={setAutoSave} />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preset</label>
                    <Select value={preset} onValueChange={(v) => setPreset(v as keyof typeof PRESETS)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pomodoro">Pomodoro (25/5/15)</SelectItem>
                        <SelectItem value="deepWork">Deep Work (52/17/30)</SelectItem>
                        <SelectItem value="sprint">Sprint (15/3/10)</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {preset === 'custom' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Focus: {customSettings.focus} min</label>
                        <Slider
                          value={[customSettings.focus]}
                          onValueChange={([v]) => setCustomSettings(s => ({ ...s, focus: v }))}
                          min={5}
                          max={90}
                          step={5}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Short Break: {customSettings.shortBreak} min</label>
                        <Slider
                          value={[customSettings.shortBreak]}
                          onValueChange={([v]) => setCustomSettings(s => ({ ...s, shortBreak: v }))}
                          min={1}
                          max={30}
                          step={1}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Long Break: {customSettings.longBreak} min</label>
                        <Slider
                          value={[customSettings.longBreak]}
                          onValueChange={([v]) => setCustomSettings(s => ({ ...s, longBreak: v }))}
                          min={5}
                          max={60}
                          step={5}
                        />
                      </div>
                    </>
                  )}
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Daily Goal: {dailyGoal} sessions</label>
                    <Slider
                      value={[dailyGoal]}
                      onValueChange={([v]) => setDailyGoal(v)}
                      min={1}
                      max={20}
                      step={1}
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {timerMode === 'timer' ? (
          <>
            {/* Mode Tabs */}
            <div className="flex gap-2 mb-6">
              {[
                { key: 'focus', label: 'Focus', icon: Brain },
                { key: 'shortBreak', label: 'Short', icon: Coffee },
                { key: 'longBreak', label: 'Long', icon: Coffee },
              ].map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant={mode === key ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    "flex-1 transition-all",
                    mode === key && "shadow-md"
                  )}
                  onClick={() => {
                    setMode(key as typeof mode);
                    setIsRunning(false);
                    releaseWakeLock();
                  }}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {label}
                </Button>
              ))}
            </div>

            {/* Timer Display */}
            <div className="text-center mb-6">
              <div 
                className={cn(
                  "inline-flex items-center justify-center w-44 h-44 rounded-full bg-gradient-to-br shadow-lg mb-4 transition-all duration-500",
                  getModeColor(),
                  isRunning && "animate-pulse-slow"
                )}
              >
                <div className="bg-card rounded-full w-36 h-36 flex items-center justify-center">
                  <span className="text-4xl font-bold font-mono tracking-tight">
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </div>
              
              {/* Time adjustment buttons */}
              <div className="flex items-center justify-center gap-2 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => adjustTime(-5)}
                  disabled={timeLeft <= 60}
                >
                  <Minus className="h-3 w-3 mr-1" />
                  5m
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => adjustTime(-1)}
                  disabled={timeLeft <= 60}
                >
                  <Minus className="h-3 w-3 mr-1" />
                  1m
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => adjustTime(1)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  1m
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => adjustTime(5)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  5m
                </Button>
              </div>
              
              <Progress value={progress} className="h-2 mb-2" />
              
              <p className="text-sm text-muted-foreground">
                {mode === 'focus' ? 'Stay focused!' : 'Take a break'}
                {isRunning && ' • Screen will stay on'}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={resetTimer}
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
              
              <Button
                size="icon"
                className={cn(
                  "h-16 w-16 rounded-full shadow-lg transition-all",
                  isRunning ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
                )}
                onClick={toggleTimer}
              >
                {isRunning ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 ml-1" />}
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={skipToNext}
              >
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>

            {/* Manual save button */}
            {!autoSave && (
              <div className="flex justify-center mb-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={manualSaveSession}
                  disabled={timeLeft === totalDuration}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Progress
                </Button>
              </div>
            )}
          </>
        ) : (
          /* Stopwatch Mode */
          <>
            <div className="text-center mb-6">
              <div 
                className={cn(
                  "inline-flex items-center justify-center w-44 h-44 rounded-full bg-gradient-to-br from-accent to-accent/80 shadow-lg mb-4 transition-all duration-500",
                  isStopwatchRunning && "animate-pulse-slow"
                )}
              >
                <div className="bg-card rounded-full w-36 h-36 flex items-center justify-center">
                  <span className="text-3xl font-bold font-mono tracking-tight">
                    {formatStopwatchTime(stopwatchTime)}
                  </span>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                {isStopwatchRunning ? 'Running • Screen will stay on' : 'Ready to track'}
              </p>
            </div>

            {/* Stopwatch Controls */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={resetStopwatch}
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
              
              <Button
                size="icon"
                className={cn(
                  "h-16 w-16 rounded-full shadow-lg transition-all",
                  isStopwatchRunning ? "bg-destructive hover:bg-destructive/90" : "bg-accent hover:bg-accent/90"
                )}
                onClick={toggleStopwatch}
              >
                {isStopwatchRunning ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 ml-1" />}
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={addLap}
                disabled={!isStopwatchRunning}
              >
                <Clock className="h-5 w-5" />
              </Button>
            </div>

            {/* Save button */}
            <div className="flex justify-center mb-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={saveStopwatchSession}
                disabled={stopwatchTime < 60000}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Session
              </Button>
            </div>

            {/* Laps */}
            {stopwatchLaps.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1 mb-4">
                {stopwatchLaps.map((lap, idx) => (
                  <div key={idx} className="flex justify-between text-sm p-2 bg-muted/30 rounded">
                    <span className="text-muted-foreground">Lap {idx + 1}</span>
                    <span className="font-mono">{formatStopwatchTime(lap)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div className="text-lg font-bold">{sessionsCompleted}/{dailyGoal}</div>
            <div className="text-xs text-muted-foreground">Sessions</div>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Flame className="h-4 w-4 text-accent" />
            </div>
            <div className="text-lg font-bold">{todayFocusMinutes}</div>
            <div className="text-xs text-muted-foreground">Minutes</div>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Trophy className="h-4 w-4 text-success" />
            </div>
            <div className="text-lg font-bold">{Math.round(goalProgress)}%</div>
            <div className="text-xs text-muted-foreground">Goal</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
