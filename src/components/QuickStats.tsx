import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, TrendingDown, Target, Flame, Calendar, 
  CheckCircle2, Clock, BarChart3, Sparkles 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyReport } from "@/types";

interface QuickStatsProps {
  reports: DailyReport[];
  todayProductivity: number;
}

export function QuickStats({ reports, todayProductivity }: QuickStatsProps) {
  const stats = useMemo(() => {
    const last7 = reports.slice(0, 7);
    const prev7 = reports.slice(7, 14);
    
    const thisWeekAvg = last7.length > 0 
      ? last7.reduce((s, r) => s + r.productivityPercent, 0) / last7.length 
      : 0;
    const lastWeekAvg = prev7.length > 0 
      ? prev7.reduce((s, r) => s + r.productivityPercent, 0) / prev7.length 
      : 0;
    const weeklyChange = thisWeekAvg - lastWeekAvg;
    
    // Streak calculation
    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < reports.length; i++) {
      const reportDate = new Date(reports[i].date);
      const daysDiff = Math.floor((today.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff === i && reports[i].productivityPercent >= 60) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    // Task completion rate
    const last7Tasks = last7.flatMap(r => r.tasks);
    const completedTasks = last7Tasks.filter(t => t.completionPercent >= 80).length;
    const completionRate = last7Tasks.length > 0 
      ? (completedTasks / last7Tasks.length) * 100 
      : 0;
    
    // Best productivity day
    const bestDay = reports.length > 0 
      ? reports.reduce((best, r) => r.productivityPercent > best.productivityPercent ? r : best)
      : null;
    
    // Average daily tasks
    const avgDailyTasks = last7.length > 0
      ? Math.round(last7.reduce((s, r) => s + r.tasks.length, 0) / last7.length)
      : 0;
    
    return {
      thisWeekAvg,
      weeklyChange,
      currentStreak,
      completionRate,
      bestDay,
      avgDailyTasks,
      totalDays: reports.length,
    };
  }, [reports]);

  const getTrendIcon = (change: number) => {
    if (change > 5) return <TrendingUp className="h-3 w-3 text-success" />;
    if (change < -5) return <TrendingDown className="h-3 w-3 text-destructive" />;
    return null;
  };

  const getProductivityColor = (value: number) => {
    if (value >= 80) return 'text-success';
    if (value >= 60) return 'text-primary';
    if (value >= 40) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="space-y-3">
      {/* Main productivity card */}
      <Card className="p-4 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Today's Progress</span>
          </div>
          <span className={cn("text-2xl font-bold", getProductivityColor(todayProductivity))}>
            {Math.round(todayProductivity)}%
          </span>
        </div>
        <Progress value={todayProductivity} className="h-2" />
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex items-center gap-1">
              {getTrendIcon(stats.weeklyChange)}
              {stats.weeklyChange !== 0 && (
                <span className={cn(
                  "text-xs font-medium",
                  stats.weeklyChange > 0 ? 'text-success' : 'text-destructive'
                )}>
                  {stats.weeklyChange > 0 ? '+' : ''}{Math.round(stats.weeklyChange)}%
                </span>
              )}
            </div>
          </div>
          <div className="text-lg font-bold">{Math.round(stats.thisWeekAvg)}%</div>
          <div className="text-xs text-muted-foreground">7-Day Avg</div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center">
              <Flame className="h-3.5 w-3.5 text-accent" />
            </div>
          </div>
          <div className="text-lg font-bold">{stats.currentStreak}</div>
          <div className="text-xs text-muted-foreground">Day Streak</div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            </div>
          </div>
          <div className="text-lg font-bold">{Math.round(stats.completionRate)}%</div>
          <div className="text-xs text-muted-foreground">Tasks Done</div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-lg bg-info/10 flex items-center justify-center">
              <Calendar className="h-3.5 w-3.5 text-info" />
            </div>
          </div>
          <div className="text-lg font-bold">{stats.totalDays}</div>
          <div className="text-xs text-muted-foreground">Days Tracked</div>
        </Card>
      </div>

      {/* Additional insights */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 bg-muted/30">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium">Avg Tasks/Day</span>
          </div>
          <div className="text-lg font-bold">{stats.avgDailyTasks}</div>
        </Card>

        {stats.bestDay && (
          <Card className="p-3 bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-xs font-medium">Best Day</span>
            </div>
            <div className="text-lg font-bold">{Math.round(stats.bestDay.productivityPercent)}%</div>
          </Card>
        )}
      </div>
    </div>
  );
}
