import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { 
  Trophy, Flame, Target, Zap, Star, Award, Crown, 
  Rocket, Medal, Heart, Sparkles, CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyReport } from "@/types";

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  requirement: (reports: DailyReport[], focusSessions?: number) => boolean;
  progress: (reports: DailyReport[], focusSessions?: number) => number;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_day',
    title: 'First Step',
    description: 'Complete your first day',
    icon: Star,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    requirement: (reports) => reports.length >= 1,
    progress: (reports) => Math.min(100, (reports.length / 1) * 100),
  },
  {
    id: 'week_warrior',
    title: 'Week Warrior',
    description: 'Track 7 consecutive days',
    icon: Flame,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    requirement: (reports) => {
      if (reports.length < 7) return false;
      const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date));
      let streak = 1;
      for (let i = 1; i < sorted.length && streak < 7; i++) {
        const curr = new Date(sorted[i].date);
        const prev = new Date(sorted[i - 1].date);
        const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
        if (diff === 1) streak++;
        else break;
      }
      return streak >= 7;
    },
    progress: (reports) => {
      if (reports.length < 1) return 0;
      const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date));
      let streak = 1;
      for (let i = 1; i < sorted.length && streak < 7; i++) {
        const curr = new Date(sorted[i].date);
        const prev = new Date(sorted[i - 1].date);
        const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
        if (diff === 1) streak++;
        else break;
      }
      return Math.min(100, (streak / 7) * 100);
    },
  },
  {
    id: 'perfect_day',
    title: 'Perfect Day',
    description: 'Achieve 100% productivity',
    icon: Crown,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    requirement: (reports) => reports.some(r => r.productivityPercent >= 100),
    progress: (reports) => {
      const best = reports.reduce((max, r) => Math.max(max, r.productivityPercent), 0);
      return Math.min(100, best);
    },
  },
  {
    id: 'productivity_master',
    title: 'Productivity Master',
    description: '80%+ average for 30 days',
    icon: Trophy,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    requirement: (reports) => {
      if (reports.length < 30) return false;
      const avg = reports.slice(0, 30).reduce((s, r) => s + r.productivityPercent, 0) / 30;
      return avg >= 80;
    },
    progress: (reports) => {
      if (reports.length < 30) return (reports.length / 30) * 50;
      const avg = reports.slice(0, 30).reduce((s, r) => s + r.productivityPercent, 0) / 30;
      return Math.min(100, 50 + (avg / 80) * 50);
    },
  },
  {
    id: 'consistent',
    title: 'Consistency King',
    description: 'Track 30 days total',
    icon: Target,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    requirement: (reports) => reports.length >= 30,
    progress: (reports) => Math.min(100, (reports.length / 30) * 100),
  },
  {
    id: 'early_bird',
    title: 'Century Club',
    description: 'Track 100 days total',
    icon: Medal,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    requirement: (reports) => reports.length >= 100,
    progress: (reports) => Math.min(100, (reports.length / 100) * 100),
  },
  {
    id: 'task_machine',
    title: 'Task Machine',
    description: 'Complete 500 tasks',
    icon: Zap,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    requirement: (reports) => {
      const completed = reports.flatMap(r => r.tasks).filter(t => t.completionPercent >= 80).length;
      return completed >= 500;
    },
    progress: (reports) => {
      const completed = reports.flatMap(r => r.tasks).filter(t => t.completionPercent >= 80).length;
      return Math.min(100, (completed / 500) * 100);
    },
  },
  {
    id: 'focus_champion',
    title: 'Focus Champion',
    description: 'Complete 50 focus sessions',
    icon: Rocket,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    requirement: (_, focusSessions) => (focusSessions ?? 0) >= 50,
    progress: (_, focusSessions) => Math.min(100, ((focusSessions ?? 0) / 50) * 100),
  },
];

interface AchievementBadgesProps {
  reports: DailyReport[];
  focusSessions?: number;
  showAll?: boolean;
}

export function AchievementBadges({ reports, focusSessions = 0, showAll = false }: AchievementBadgesProps) {
  const achievementStatus = useMemo(() => {
    return ACHIEVEMENTS.map(achievement => ({
      ...achievement,
      unlocked: achievement.requirement(reports, focusSessions),
      progressValue: achievement.progress(reports, focusSessions),
    }));
  }, [reports, focusSessions]);

  const unlockedCount = achievementStatus.filter(a => a.unlocked).length;
  const displayAchievements = showAll 
    ? achievementStatus 
    : achievementStatus.slice(0, 4);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Achievements</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          {unlockedCount}/{ACHIEVEMENTS.length} unlocked
        </span>
      </div>
      
      <div className="grid grid-cols-4 gap-3">
        {displayAchievements.map(achievement => {
          const Icon = achievement.icon;
          return (
            <div
              key={achievement.id}
              className={cn(
                "relative flex flex-col items-center p-3 rounded-lg transition-all",
                achievement.unlocked 
                  ? `${achievement.bgColor} shadow-sm` 
                  : "bg-muted/50 opacity-50"
              )}
              title={`${achievement.title}: ${achievement.description} (${Math.round(achievement.progressValue)}%)`}
            >
              <div className={cn(
                "relative mb-2",
                achievement.unlocked && "animate-float"
              )}>
                <Icon className={cn(
                  "h-6 w-6",
                  achievement.unlocked ? achievement.color : "text-muted-foreground"
                )} />
                {achievement.unlocked && (
                  <CheckCircle2 className="absolute -bottom-1 -right-1 h-3 w-3 text-success" />
                )}
              </div>
              <span className="text-[10px] font-medium text-center leading-tight">
                {achievement.title}
              </span>
              {!achievement.unlocked && (
                <div className="absolute bottom-1 left-1 right-1">
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary/50 rounded-full transition-all"
                      style={{ width: `${achievement.progressValue}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
