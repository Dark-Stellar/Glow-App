import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { 
  Lightbulb, TrendingUp, TrendingDown, AlertCircle, 
  CheckCircle2, Clock, Target, Zap, Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyReport } from "@/types";

interface Suggestion {
  id: string;
  type: 'success' | 'warning' | 'tip' | 'insight';
  title: string;
  description: string;
  icon: React.ElementType;
}

interface SmartSuggestionsProps {
  reports: DailyReport[];
  todayProductivity: number;
}

export function SmartSuggestions({ reports, todayProductivity }: SmartSuggestionsProps) {
  const suggestions = useMemo(() => {
    const result: Suggestion[] = [];
    
    // Week performance check
    const last7 = reports.slice(0, 7);
    const thisWeekAvg = last7.length > 0 
      ? last7.reduce((s, r) => s + r.productivityPercent, 0) / last7.length 
      : 0;
    
    const prev7 = reports.slice(7, 14);
    const lastWeekAvg = prev7.length > 0 
      ? prev7.reduce((s, r) => s + r.productivityPercent, 0) / prev7.length 
      : 0;
    
    if (thisWeekAvg > lastWeekAvg + 10) {
      result.push({
        id: 'week-improvement',
        type: 'success',
        title: 'Great Progress!',
        description: `You're up ${Math.round(thisWeekAvg - lastWeekAvg)}% from last week. Keep it up!`,
        icon: TrendingUp,
      });
    } else if (thisWeekAvg < lastWeekAvg - 10) {
      result.push({
        id: 'week-decline',
        type: 'warning',
        title: 'Productivity Dip',
        description: `You're down ${Math.round(lastWeekAvg - thisWeekAvg)}% this week. Try breaking tasks into smaller pieces.`,
        icon: TrendingDown,
      });
    }
    
    // Best day insight
    const dayScores: Record<number, { total: number; count: number }> = {};
    reports.forEach(r => {
      const day = new Date(r.date).getDay();
      if (!dayScores[day]) dayScores[day] = { total: 0, count: 0 };
      dayScores[day].total += r.productivityPercent;
      dayScores[day].count++;
    });
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let bestDay = { day: 0, avg: 0 };
    let worstDay = { day: 0, avg: 100 };
    
    Object.entries(dayScores).forEach(([day, scores]) => {
      if (scores.count >= 2) {
        const avg = scores.total / scores.count;
        if (avg > bestDay.avg) bestDay = { day: parseInt(day), avg };
        if (avg < worstDay.avg) worstDay = { day: parseInt(day), avg };
      }
    });
    
    if (bestDay.avg > 0) {
      result.push({
        id: 'best-day',
        type: 'insight',
        title: `${dayNames[bestDay.day]}s Are Your Best`,
        description: `You average ${Math.round(bestDay.avg)}% on ${dayNames[bestDay.day]}s. Schedule important tasks then!`,
        icon: Calendar,
      });
    }
    
    // Streak check
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < reports.length; i++) {
      const reportDate = new Date(reports[i].date);
      const daysDiff = Math.floor((today.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff === i && reports[i].productivityPercent >= 60) {
        streak++;
      } else {
        break;
      }
    }
    
    if (streak >= 7) {
      result.push({
        id: 'streak',
        type: 'success',
        title: `${streak}-Day Streak! 🔥`,
        description: "You're on fire! Don't break the chain.",
        icon: Zap,
      });
    } else if (streak === 0 && todayProductivity < 60) {
      result.push({
        id: 'start-streak',
        type: 'tip',
        title: 'Start a Streak',
        description: 'Hit 60%+ today to begin a new productivity streak!',
        icon: Target,
      });
    }
    
    // Task completion patterns
    const allTasks = reports.flatMap(r => r.tasks);
    const avgWeight = allTasks.length > 0 
      ? allTasks.reduce((s, t) => s + t.weight, 0) / allTasks.length 
      : 0;
    
    const heavyTasks = allTasks.filter(t => t.weight > avgWeight * 1.5);
    const heavyCompletionRate = heavyTasks.length > 0
      ? heavyTasks.filter(t => t.completionPercent >= 80).length / heavyTasks.length
      : 1;
    
    if (heavyCompletionRate < 0.5) {
      result.push({
        id: 'heavy-tasks',
        type: 'tip',
        title: 'Break Down Big Tasks',
        description: 'Heavy-weight tasks have lower completion. Try splitting them up.',
        icon: AlertCircle,
      });
    }
    
    // Today specific
    if (todayProductivity >= 80) {
      result.push({
        id: 'today-great',
        type: 'success',
        title: 'Excellent Day!',
        description: `${Math.round(todayProductivity)}% is outstanding. You're crushing it!`,
        icon: CheckCircle2,
      });
    } else if (todayProductivity < 40) {
      result.push({
        id: 'today-low',
        type: 'tip',
        title: 'Focus on One Thing',
        description: 'Pick your most important task and complete it fully.',
        icon: Clock,
      });
    }
    
    return result.slice(0, 4);
  }, [reports, todayProductivity]);

  const getTypeStyles = (type: Suggestion['type']) => {
    switch (type) {
      case 'success':
        return 'bg-success/10 border-success/20 text-success';
      case 'warning':
        return 'bg-warning/10 border-warning/20 text-warning';
      case 'tip':
        return 'bg-primary/10 border-primary/20 text-primary';
      case 'insight':
        return 'bg-info/10 border-info/20 text-info';
    }
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-5 w-5 text-accent" />
        <h3 className="font-semibold">Smart Suggestions</h3>
      </div>
      
      <div className="space-y-3">
        {suggestions.map(suggestion => {
          const Icon = suggestion.icon;
          return (
            <div
              key={suggestion.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-all hover:shadow-sm",
                getTypeStyles(suggestion.type)
              )}
            >
              <div className="mt-0.5">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium">{suggestion.title}</h4>
                <p className="text-xs opacity-80 mt-0.5">{suggestion.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
