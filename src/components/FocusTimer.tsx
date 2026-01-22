import { useState, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Play, Pause, RotateCcw, SkipForward, Settings, Coffee, Brain,
  Volume2, VolumeX, Flame, Target, Trophy, Timer
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

export function FocusTimer() {
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
  
  const settings = useMemo(() => 
    preset === 'custom' ? customSettings : PRESETS[preset]
  , [preset, customSettings]);

  useEffect(() => {
    loadTodaySessions();
  }, []);

  useEffect(() => {
    const duration = mode === 'focus' 
      ? settings.focus 
      : mode === 'shortBreak' 
      ? settings.shortBreak 
      : settings.longBreak;
    setTimeLeft(duration * 60);
  }, [mode, settings]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      handleSessionComplete();
    }
    
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

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
    
    if (soundEnabled) {
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleT8LE3exy+mwVhMAN5zK7tybThkLR4K+4sJwKA4nf8TtzHs1CQRQsNrlqVkVCS2d0+GrXBsLNp3W5aJSEwUsl9XnmUQHBBKa3eqbRgMCQJPN5Y9DBQglnuDqgCYHCyOR5OqBMAsKFonh5n8tBQAIk+Poby4ICQ6W5eN3MAQCCpLk5HoyBQoHi+bifT4GBQiM4+OFQQAFDpTl5X8qAAoKkuTlfjAFCQmP5OV+MgYJCI/k5YM0BQcIjuTlhjgGBwiM5OWIOgcHB4vj5ok8BwUGi+PnizwIBQWK4+iNPggFBInj6I89CAQD');
        audio.play();
      } catch (e) {
        // Audio not available
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
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
  }, [mode, settings, sessionsCompleted, soundEnabled, loadTodaySessions]);

  const toggleTimer = useCallback(() => {
    setIsRunning(prev => !prev);
  }, []);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    const duration = mode === 'focus' 
      ? settings.focus 
      : mode === 'shortBreak' 
      ? settings.shortBreak 
      : settings.longBreak;
    setTimeLeft(duration * 60);
  }, [mode, settings]);

  const skipToNext = useCallback(() => {
    if (mode === 'focus') {
      setMode(sessionsCompleted % 4 === 3 ? 'longBreak' : 'shortBreak');
    } else {
      setMode('focus');
    }
    setIsRunning(false);
  }, [mode, sessionsCompleted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDuration = mode === 'focus' 
    ? settings.focus * 60 
    : mode === 'shortBreak' 
    ? settings.shortBreak * 60 
    : settings.longBreak * 60;
  
  const progress = ((totalDuration - timeLeft) / totalDuration) * 100;

  const todayFocusMinutes = useMemo(() => 
    todaySessions
      .filter(s => s.focus_type === 'focus')
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

  const getModeIcon = () => {
    switch (mode) {
      case 'focus': return <Brain className="h-6 w-6" />;
      case 'shortBreak': return <Coffee className="h-6 w-6" />;
      case 'longBreak': return <Coffee className="h-6 w-6" />;
    }
  };

  return (
    <Card className="p-6 relative overflow-hidden">
      {/* Background glow */}
      <div 
        className={cn(
          "absolute inset-0 opacity-10 transition-all duration-500 bg-gradient-to-br",
          getModeColor()
        )}
      />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Focus Timer</h3>
          </div>
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
          
          <Progress value={progress} className="h-2 mb-2" />
          
          <p className="text-sm text-muted-foreground">
            {mode === 'focus' ? 'Stay focused!' : 'Take a break'}
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
