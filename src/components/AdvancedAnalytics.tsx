import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { 
  TrendingUp, TrendingDown, Minus, Calendar, 
  Sun, Moon, Clock, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyReport } from "@/types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface HeatmapCalendarProps {
  reports: DailyReport[];
  daysToShow?: number;
}

export function HeatmapCalendar({ reports, daysToShow = 28 }: HeatmapCalendarProps) {
  const heatmapData = useMemo(() => {
    const reportMap = new Map(reports.map(r => [r.date, r.productivityPercent]));
    const days: { date: Date; productivity: number | null; dayName: string }[] = [];
    
    const today = new Date();
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const productivity = reportMap.get(dateStr) ?? null;
      days.push({
        date,
        productivity,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      });
    }
    
    return days;
  }, [reports, daysToShow]);

  const getColor = (productivity: number | null) => {
    if (productivity === null) return 'bg-muted/50';
    if (productivity >= 80) return 'bg-success';
    if (productivity >= 60) return 'bg-primary';
    if (productivity >= 40) return 'bg-warning';
    return 'bg-destructive';
  };

  const getOpacity = (productivity: number | null) => {
    if (productivity === null) return 'opacity-30';
    if (productivity >= 80) return 'opacity-100';
    if (productivity >= 60) return 'opacity-80';
    if (productivity >= 40) return 'opacity-60';
    return 'opacity-50';
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Activity Heatmap</h3>
      </div>
      
      <div className="grid grid-cols-7 gap-1.5">
        {heatmapData.map((day, idx) => (
          <div
            key={idx}
            className={cn(
              "aspect-square rounded-md flex items-center justify-center text-[10px] font-medium transition-all hover:scale-110 cursor-default",
              getColor(day.productivity),
              getOpacity(day.productivity),
              day.productivity !== null && "text-white"
            )}
            title={`${day.date.toLocaleDateString()}: ${day.productivity !== null ? `${Math.round(day.productivity)}%` : 'No data'}`}
          >
            {day.date.getDate()}
          </div>
        ))}
      </div>
      
      <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded bg-muted/50 opacity-30" />
          <div className="w-4 h-4 rounded bg-destructive opacity-50" />
          <div className="w-4 h-4 rounded bg-warning opacity-60" />
          <div className="w-4 h-4 rounded bg-primary opacity-80" />
          <div className="w-4 h-4 rounded bg-success" />
        </div>
        <span>More</span>
      </div>
    </Card>
  );
}

interface TimeOfDayAnalysisProps {
  reports: DailyReport[];
}

export function TimeOfDayAnalysis({ reports }: TimeOfDayAnalysisProps) {
  // This would need actual time tracking data
  // For now, show day of week patterns
  const dayPatterns = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const scores: Record<number, { total: number; count: number }> = {};
    
    reports.forEach(r => {
      const day = new Date(r.date).getDay();
      if (!scores[day]) scores[day] = { total: 0, count: 0 };
      scores[day].total += r.productivityPercent;
      scores[day].count++;
    });
    
    return dayNames.map((name, idx) => ({
      name,
      avg: scores[idx] ? Math.round(scores[idx].total / scores[idx].count) : 0,
      count: scores[idx]?.count || 0,
    }));
  }, [reports]);

  const getBarColor = (value: number) => {
    if (value >= 80) return 'hsl(142, 76%, 36%)';
    if (value >= 60) return 'hsl(270, 60%, 45%)';
    if (value >= 40) return 'hsl(45, 95%, 55%)';
    return 'hsl(0, 70%, 50%)';
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Performance by Day</h3>
      </div>
      
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={dayPatterns}>
          <XAxis 
            dataKey="name" 
            fontSize={10} 
            stroke="hsl(var(--muted-foreground))" 
          />
          <YAxis 
            fontSize={9} 
            stroke="hsl(var(--muted-foreground))" 
            domain={[0, 100]} 
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px'
            }}
            formatter={(value: number) => [`${value}%`, 'Average']}
          />
          <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
            {dayPatterns.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.avg)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

interface ProductivityStreakProps {
  reports: DailyReport[];
}

export function ProductivityStreak({ reports }: ProductivityStreakProps) {
  const streakInfo = useMemo(() => {
    // Current streak
    let currentStreak = 0;
    const today = new Date();
    const sortedReports = [...reports].sort((a, b) => b.date.localeCompare(a.date));
    
    for (let i = 0; i < sortedReports.length; i++) {
      const reportDate = new Date(sortedReports[i].date);
      const daysDiff = Math.floor((today.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff === i && sortedReports[i].productivityPercent >= 60) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    // Best streak
    let bestStreak = 0;
    let tempStreak = 0;
    const chronological = [...sortedReports].reverse();
    
    for (let i = 0; i < chronological.length; i++) {
      if (i === 0 || 
        (new Date(chronological[i].date).getTime() - new Date(chronological[i-1].date).getTime() === 86400000)) {
        if (chronological[i].productivityPercent >= 60) {
          tempStreak++;
          bestStreak = Math.max(bestStreak, tempStreak);
        } else {
          tempStreak = 0;
        }
      } else {
        tempStreak = chronological[i].productivityPercent >= 60 ? 1 : 0;
      }
    }
    
    // 80%+ days count
    const highPerfDays = reports.filter(r => r.productivityPercent >= 80).length;
    
    // Perfect days (100%)
    const perfectDays = reports.filter(r => r.productivityPercent >= 100).length;
    
    return { currentStreak, bestStreak, highPerfDays, perfectDays };
  }, [reports]);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-5 w-5 text-accent" />
        <h3 className="font-semibold">Streak & Milestones</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
          <div className="text-2xl font-bold text-primary">{streakInfo.currentStreak}</div>
          <div className="text-xs text-muted-foreground">Current Streak</div>
        </div>
        
        <div className="p-3 rounded-lg bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20">
          <div className="text-2xl font-bold text-accent">{streakInfo.bestStreak}</div>
          <div className="text-xs text-muted-foreground">Best Streak</div>
        </div>
        
        <div className="p-3 rounded-lg bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
          <div className="text-2xl font-bold text-success">{streakInfo.highPerfDays}</div>
          <div className="text-xs text-muted-foreground">80%+ Days</div>
        </div>
        
        <div className="p-3 rounded-lg bg-gradient-to-br from-info/10 to-info/5 border border-info/20">
          <div className="text-2xl font-bold text-info">{streakInfo.perfectDays}</div>
          <div className="text-xs text-muted-foreground">Perfect Days</div>
        </div>
      </div>
    </Card>
  );
}
