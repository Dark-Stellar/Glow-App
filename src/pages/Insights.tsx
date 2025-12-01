import { useEffect, useState } from "react";
import { MobileLayout } from "@/components/MobileLayout";
import { Card } from "@/components/ui/card";
import { getAllDailyReports } from "@/lib/storage";
import { Brain, TrendingUp, Calendar, Award, Target, Sparkles } from "lucide-react";
import type { DailyReport } from "@/types";
import { Progress } from "@/components/ui/progress";

const Insights = () => {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadInsights();
  }, []);
  
  async function loadInsights() {
    const allReports = await getAllDailyReports();
    setReports(allReports.sort((a, b) => b.date.localeCompare(a.date)));
    setLoading(false);
  }
  
  if (loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-muted-foreground">Analyzing your data...</div>
        </div>
      </MobileLayout>
    );
  }
  
  // Calculate insights
  const bestDayOfWeek = (() => {
    const dayScores: { [key: number]: { total: number; count: number } } = {};
    reports.forEach(r => {
      const day = new Date(r.date).getDay();
      if (!dayScores[day]) dayScores[day] = { total: 0, count: 0 };
      dayScores[day].total += r.productivityPercent;
      dayScores[day].count += 1;
    });
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let bestDay = { day: 0, avg: 0 };
    Object.entries(dayScores).forEach(([day, scores]) => {
      const avg = scores.total / scores.count;
      if (avg > bestDay.avg) {
        bestDay = { day: parseInt(day), avg };
      }
    });
    
    return { name: dayNames[bestDay.day], avg: bestDay.avg };
  })();
  
  // Best performing tasks
  const topTasks = (() => {
    const taskStats: { [key: string]: { total: number; count: number; category?: string } } = {};
    reports.forEach(r => {
      r.tasks.forEach(t => {
        if (!taskStats[t.title]) taskStats[t.title] = { total: 0, count: 0, category: t.category };
        taskStats[t.title].total += t.completionPercent;
        taskStats[t.title].count += 1;
      });
    });
    
    return Object.entries(taskStats)
      .map(([title, stats]) => ({
        title,
        avg: stats.total / stats.count,
        count: stats.count,
        category: stats.category
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  })();
  
  // Category breakdown
  const categoryPerformance = (() => {
    const catStats: { [key: string]: { total: number; count: number } } = {};
    reports.forEach(r => {
      r.tasks.forEach(t => {
        const cat = t.category || 'Other';
        if (!catStats[cat]) catStats[cat] = { total: 0, count: 0 };
        catStats[cat].total += t.completionPercent;
        catStats[cat].count += 1;
      });
    });
    
    return Object.entries(catStats)
      .map(([category, stats]) => ({
        category,
        avg: stats.total / stats.count,
        count: stats.count
      }))
      .sort((a, b) => b.avg - a.avg);
  })();
  
  // Consistency score (how often they track)
  const consistencyScore = (() => {
    if (reports.length === 0) return 0;
    const oldestDate = new Date(reports[reports.length - 1].date);
    const today = new Date();
    const daysSinceStart = Math.floor((today.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.min(100, Math.round((reports.length / daysSinceStart) * 100));
  })();
  
  // Improvement trend
  const improvementTrend = (() => {
    if (reports.length < 14) return null;
    const firstWeek = reports.slice(-7).reduce((sum, r) => sum + r.productivityPercent, 0) / 7;
    const lastWeek = reports.slice(0, 7).reduce((sum, r) => sum + r.productivityPercent, 0) / 7;
    const change = lastWeek - firstWeek;
    return { change, improving: change > 0 };
  })();
  
  return (
    <MobileLayout>
      <div className="container max-w-2xl mx-auto p-4 space-y-4">
        <div className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Insights</h1>
          </div>
          <p className="text-sm text-muted-foreground">Discover your patterns</p>
        </div>
        
        {reports.length < 7 && (
          <Card className="p-4 bg-accent/5">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-accent mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">Keep Going!</h3>
                <p className="text-xs text-muted-foreground">
                  Track at least 7 days to unlock deeper insights and patterns about your productivity.
                </p>
              </div>
            </div>
          </Card>
        )}
        
        {/* Best Day */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Best Day Pattern</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{bestDayOfWeek.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Your most productive day of the week
              </div>
            </div>
            <div className="text-3xl font-bold text-primary">
              {Math.round(bestDayOfWeek.avg)}%
            </div>
          </div>
        </Card>
        
        {/* Consistency */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-success" />
            <h3 className="font-semibold">Consistency Score</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">How often you track</span>
              <span className="font-bold">{consistencyScore}%</span>
            </div>
            <Progress value={consistencyScore} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {consistencyScore >= 80 ? "Excellent! You're very consistent." :
               consistencyScore >= 60 ? "Good consistency. Keep it up!" :
               consistencyScore >= 40 ? "Try to track more regularly for better insights." :
               "Track daily to build better habits!"}
            </p>
          </div>
        </Card>
        
        {/* Improvement Trend */}
        {improvementTrend && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className={`h-5 w-5 ${improvementTrend.improving ? 'text-success' : 'text-warning'}`} />
              <h3 className="font-semibold">Recent Trend</h3>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-2xl font-bold ${improvementTrend.improving ? 'text-success' : 'text-warning'}`}>
                  {improvementTrend.improving ? '+' : ''}{Math.round(improvementTrend.change)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Change from first week to last week
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {improvementTrend.improving ? 'Improving! 📈' : 'Time to refocus 💪'}
              </div>
            </div>
          </Card>
        )}
        
        {/* Top Tasks */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award className="h-5 w-5 text-accent" />
            <h3 className="font-semibold">Top Performing Tasks</h3>
          </div>
          <div className="space-y-3">
            {topTasks.map((task, idx) => (
              <div key={task.title} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{task.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {task.category || 'Other'} • {task.count} times
                  </div>
                </div>
                <div className="text-sm font-bold text-success flex-shrink-0">
                  {Math.round(task.avg)}%
                </div>
              </div>
            ))}
          </div>
        </Card>
        
        {/* Category Performance */}
        {categoryPerformance.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Category Breakdown</h3>
            <div className="space-y-3">
              {categoryPerformance.map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{cat.category}</span>
                    <span className="text-muted-foreground">{Math.round(cat.avg)}%</span>
                  </div>
                  <Progress value={cat.avg} className="h-2" />
                  <div className="text-xs text-muted-foreground mt-1">
                    {cat.count} task{cat.count > 1 ? 's' : ''} tracked
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
};

export default Insights;
