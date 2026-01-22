import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, TrendingDown, Target, Award, Star, 
  Calendar, Zap, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyReport, ProductivityGoal } from "@/types";
import { Link } from "react-router-dom";

interface GoalProgressCardProps {
  goals: ProductivityGoal[];
  reports: DailyReport[];
}

export function GoalProgressCard({ goals, reports }: GoalProgressCardProps) {
  const goalProgress = useMemo(() => {
    return goals.map(goal => {
      const relevantReports = reports.filter(
        r => r.date >= goal.startDate && r.date <= goal.endDate
      );
      const avgProgress = relevantReports.length > 0 
        ? relevantReports.reduce((sum, r) => sum + r.productivityPercent, 0) / relevantReports.length 
        : 0;
      const daysLeft = Math.ceil(
        (new Date(goal.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      const progressPercent = Math.min(100, (avgProgress / goal.targetPercentage) * 100);
      const isOnTrack = avgProgress >= goal.targetPercentage;
      
      return { 
        ...goal, 
        avgProgress, 
        daysLeft, 
        progressPercent,
        isOnTrack,
        isActive: daysLeft >= 0 
      };
    }).filter(g => g.isActive);
  }, [goals, reports]);

  if (goalProgress.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Active Goals</h3>
          </div>
          <Link to="/goals">
            <Button variant="ghost" size="sm">
              Create Goal
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          No active goals. Set a goal to track your progress!
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Active Goals</h3>
        </div>
        <Link to="/goals">
          <Button variant="ghost" size="sm">
            View All
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>
      
      <div className="space-y-4">
        {goalProgress.slice(0, 3).map(goal => (
          <div 
            key={goal.id} 
            className={cn(
              "p-3 rounded-lg border transition-all",
              goal.isOnTrack 
                ? "bg-success/5 border-success/20" 
                : "bg-muted/30 border-border"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
                  goal.goalType === 'daily' && "bg-info/10 text-info",
                  goal.goalType === 'weekly' && "bg-primary/10 text-primary",
                  goal.goalType === 'monthly' && "bg-accent/10 text-accent"
                )}>
                  {goal.goalType}
                </span>
                <span className="text-sm font-medium">
                  Target: {goal.targetPercentage}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                {goal.isOnTrack ? (
                  <Star className="h-4 w-4 text-success fill-success" />
                ) : goal.avgProgress >= goal.targetPercentage * 0.8 ? (
                  <TrendingUp className="h-4 w-4 text-warning" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
              </div>
            </div>
            
            <Progress value={goal.progressPercent} className="h-2 mb-2" />
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Current: <span className={cn(
                  "font-medium",
                  goal.isOnTrack ? "text-success" : "text-foreground"
                )}>{Math.round(goal.avgProgress)}%</span>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {goal.daysLeft} days left
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

interface WeeklyComparisonCardProps {
  reports: DailyReport[];
}

export function WeeklyComparisonCard({ reports }: WeeklyComparisonCardProps) {
  const comparison = useMemo(() => {
    if (reports.length < 7) return null;
    
    const thisWeek = reports.slice(0, 7);
    const lastWeek = reports.slice(7, 14);
    
    const thisWeekAvg = thisWeek.reduce((s, r) => s + r.productivityPercent, 0) / thisWeek.length;
    const lastWeekAvg = lastWeek.length > 0 
      ? lastWeek.reduce((s, r) => s + r.productivityPercent, 0) / lastWeek.length 
      : thisWeekAvg;
    
    const change = thisWeekAvg - lastWeekAvg;
    const changePercent = lastWeekAvg > 0 ? (change / lastWeekAvg) * 100 : 0;
    
    // Best day this week
    const bestDay = thisWeek.reduce((best, r) => 
      r.productivityPercent > best.productivityPercent ? r : best
    );
    
    // Tasks completed
    const tasksCompleted = thisWeek.flatMap(r => r.tasks)
      .filter(t => t.completionPercent >= 80).length;
    
    return {
      thisWeekAvg,
      lastWeekAvg,
      change,
      changePercent,
      improving: change > 0,
      bestDay,
      tasksCompleted,
    };
  }, [reports]);

  if (!comparison) {
    return null;
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-5 w-5 text-accent" />
        <h3 className="font-semibold">This Week vs Last</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">
            {Math.round(comparison.thisWeekAvg)}%
          </div>
          <div className="text-xs text-muted-foreground">This Week</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-muted-foreground">
            {Math.round(comparison.lastWeekAvg)}%
          </div>
          <div className="text-xs text-muted-foreground">Last Week</div>
        </div>
      </div>
      
      <div className={cn(
        "flex items-center justify-center gap-2 p-3 rounded-lg mb-4",
        comparison.improving 
          ? "bg-success/10 text-success" 
          : comparison.change === 0 
          ? "bg-muted/50 text-muted-foreground"
          : "bg-destructive/10 text-destructive"
      )}>
        {comparison.improving ? (
          <TrendingUp className="h-5 w-5" />
        ) : comparison.change === 0 ? (
          <span className="text-sm">No change</span>
        ) : (
          <TrendingDown className="h-5 w-5" />
        )}
        <span className="font-bold text-lg">
          {comparison.change > 0 ? '+' : ''}{Math.round(comparison.change)}%
        </span>
        <span className="text-sm">
          ({comparison.changePercent > 0 ? '+' : ''}{Math.round(comparison.changePercent)}%)
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-2 rounded bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">Best Day</div>
          <div className="font-medium">
            {new Date(comparison.bestDay.date).toLocaleDateString('en-US', { weekday: 'short' })}
            {' '}- {Math.round(comparison.bestDay.productivityPercent)}%
          </div>
        </div>
        <div className="p-2 rounded bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">Tasks Done</div>
          <div className="font-medium">{comparison.tasksCompleted} completed</div>
        </div>
      </div>
    </Card>
  );
}
