import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Play, Pause, RotateCcw, SkipForward, Settings, Coffee, Brain,
  Volume2, VolumeX, Flame, Target, Trophy, Timer, Save,
  Plus, Minus, Clock, Watch, Square
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimer } from "@/contexts/TimerContext";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

const PRESETS = {
  pomodoro: { focus: 25, shortBreak: 5, longBreak: 15 },
  deepWork: { focus: 52, shortBreak: 17, longBreak: 30 },
  sprint: { focus: 15, shortBreak: 3, longBreak: 10 },
  custom: { focus: 30, shortBreak: 5, longBreak: 15 },
};

export function FocusTimer() {
  const [timerMode, setTimerMode] = useState<'timer' | 'stopwatch'>('timer');
  const [showSettings, setShowSettings] = useState(false);
  
  const {
    mode,
    timeLeft,
    isRunning,
    sessionsCompleted,
    preset,
    customSettings,
    soundEnabled,
    autoSave,
    dailyGoal,
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
  } = useTimer();

  const totalDuration = mode === 'focus' 
    ? settings.focus * 60 
    : mode === 'shortBreak' 
    ? settings.shortBreak * 60 
    : settings.longBreak * 60;
  
  const progress = ((totalDuration - timeLeft) / totalDuration) * 100;

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
                          onValueChange={([v]) => setCustomSettings({ ...customSettings, focus: v })}
                          min={5}
                          max={90}
                          step={5}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Short Break: {customSettings.shortBreak} min</label>
                        <Slider
                          value={[customSettings.shortBreak]}
                          onValueChange={([v]) => setCustomSettings({ ...customSettings, shortBreak: v })}
                          min={1}
                          max={30}
                          step={1}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Long Break: {customSettings.longBreak} min</label>
                        <Slider
                          value={[customSettings.longBreak]}
                          onValueChange={([v]) => setCustomSettings({ ...customSettings, longBreak: v })}
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
                  onClick={() => setMode(key as typeof mode)}
                  disabled={isAlarmRinging}
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
                  isRunning && "animate-pulse-slow",
                  isAlarmRinging && "animate-pulse ring-4 ring-destructive"
                )}
              >
                <div className="bg-card rounded-full w-36 h-36 flex items-center justify-center">
                  <span className="text-4xl font-bold font-mono tracking-tight">
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </div>
              
              {/* Time adjustment buttons - hidden when alarm is ringing */}
              {!isAlarmRinging && (
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
              )}
              
              <Progress value={progress} className="h-2 mb-2" />
              
              <p className="text-sm text-muted-foreground">
                {isAlarmRinging ? '🔔 Time is up! Tap Stop to dismiss' : 
                  mode === 'focus' ? 'Stay focused!' : 'Take a break'}
                {isRunning && !isAlarmRinging && ' • Screen will stay on'}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 mb-6">
              {isAlarmRinging ? (
                /* Stop Alarm Button */
                <Button
                  size="lg"
                  className="h-16 px-8 rounded-full shadow-lg bg-destructive hover:bg-destructive/90 animate-pulse"
                  onClick={stopAlarm}
                >
                  <Square className="h-6 w-6 mr-2" />
                  Stop Alarm
                </Button>
              ) : (
                <>
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
                </>
              )}
            </div>

            {/* Manual save button */}
            {!autoSave && !isAlarmRinging && (
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
