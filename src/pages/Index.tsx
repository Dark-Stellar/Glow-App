import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus, PlayCircle, Calendar as CalendarIcon, FileText, Rocket, ChevronRight, Sparkles, TrendingUp, TrendingDown, Flame, Award, Target } from "lucide-react";
import { MobileLayout } from "@/components/MobileLayout";
import { PageHeader } from "@/components/PageHeader";
import { ProgressRing } from "@/components/ProgressRing";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getDailyReport, getDraftTasks, calculateProductivity, getAllDailyReports } from "@/lib/storage";
import { getTodayString, formatDisplayDate } from "@/lib/dates";
import { exportDashboardPDF } from "@/lib/exportUtils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Task, DailyReport, Mission } from "@/types";

const Index = () => {
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [productivity, setProductivity] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    loadTodayData();
    loadMissions();
    updateGreeting();
  }, []);

  const updateGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const loadTodayData = useCallback(async () => {
    const today = getTodayString();
    const allReports = await getAllDailyReports();
    setReports(allReports.sort((a, b) => b.date.localeCompare(a.date)));

    const report = await getDailyReport(today);
    if (report) {
      setTodayTasks(report.tasks);
      setProductivity(report.productivityPercent);
    } else {
      const draft = await getDraftTasks(today);
      if (draft) {
        setTodayTasks(draft);
        setProductivity(calculateProductivity(draft));
      }
    }
    setLoading(false);
  }, []);

  const loadMissions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data } = await supabase
      .from('missions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_completed', false)
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (data) {
      setMissions(data.map(m => ({
        id: m.id,
        title: m.title,
        description: m.description || undefined,
        progressPercent: Number(m.progress_percent),
        category: m.category || 'personal',
        targetDate: m.target_date || undefined,
        isCompleted: m.is_completed,
        createdAt: m.created_at,
        updatedAt: m.updated_at
      })));
    }
  }, []);

  const stats = useMemo(() => {
    const totalDays = reports.length;
    const avgProductivity = totalDays > 0 ? reports.reduce((sum, r) => sum + r.productivityPercent, 0) / totalDays : 0;
    const last7Days = reports.slice(0, 7);
    const avg7Days = last7Days.length > 0 ? last7Days.reduce((sum, r) => sum + r.productivityPercent, 0) / last7Days.length : 0;
    const prev7Days = reports.slice(7, 14);
    const avgPrev7 = prev7Days.length > 0 ? prev7Days.reduce((sum, r) => sum + r.productivityPercent, 0) / prev7Days.length : 0;
    const weeklyChange = avg7Days - avgPrev7;
    const bestDay = reports.length > 0 ? reports.reduce((best, r) => r.productivityPercent > best.productivityPercent ? r : best) : null;

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
    return { totalDays, avgProductivity, avg7Days, avgPrev7, weeklyChange, currentStreak, bestDay, todayTasks, todayProductivity: productivity };
  }, [reports, todayTasks, productivity]);

  const handleExportPDF = useCallback(async () => {
    try {
      toast.loading("Generating PDF...");
      await exportDashboardPDF(stats, reports);
      toast.dismiss();
      toast.success("Dashboard exported as PDF!");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to export PDF");
    }
  }, [stats, reports]);

  const getMotivationalMessage = useCallback(() => {
    if (productivity >= 90) return "Outstanding! You're crushing it! 🏆";
    if (productivity >= 75) return "Great progress today! Keep it up! 🌟";
    if (productivity >= 50) return "Good effort! You're halfway there! 💪";
    if (productivity > 0) return "You've started - that's what matters! 🚀";
    return "Ready to make today count? ✨";
  }, [productivity]);

  if (loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </MobileLayout>
    );
  }

  const hasTasksToday = todayTasks.length > 0;
  const completedTasks = todayTasks.filter(t => t.completionPercent === 100).length;
  const inProgressTasks = todayTasks.filter(t => t.completionPercent > 0 && t.completionPercent < 100).length;

  return (
    <MobileLayout>
      <div className="w-full max-w-lg mx-auto px-4 py-3 space-y-4">
        <PageHeader
          title="Glow"
          subtitle={greeting}
          icon={Sparkles}
          actions={
            <Button variant="ghost" size="icon" onClick={handleExportPDF} title="Export as PDF">
              <FileText className="h-4 w-4" />
            </Button>
          }
        />
        
        {/* Progress Ring with Motivational Message */}
        <div className="flex flex-col items-center py-4">
          <ProgressRing progress={productivity} />
          <p className="text-sm text-muted-foreground mt-3 text-center animate-fade-in">
            {getMotivationalMessage()}
          </p>
        </div>

        {/* Trend Indicator */}
        {reports.length >= 7 && (
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {stats.weeklyChange >= 0 ? (
                  <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-success" />
                  </div>
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium">Weekly Trend</div>
                  <div className="text-xs text-muted-foreground">vs last week</div>
                </div>
              </div>
              <div className={`text-lg font-bold ${stats.weeklyChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                {stats.weeklyChange >= 0 ? '+' : ''}{Math.round(stats.weeklyChange)}%
              </div>
            </div>
          </Card>
        )}
        
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/tasks">
            <Card className="p-4 hover:bg-accent/5 transition-all duration-200 cursor-pointer h-full hover:shadow-md group">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">Edit Plan</div>
                  <div className="text-xs text-muted-foreground">Set up tasks</div>
                </div>
              </div>
            </Card>
          </Link>
          
          <Link to={hasTasksToday ? `/day/${getTodayString()}` : "/tasks"}>
            <Card className="p-4 hover:bg-accent/5 transition-all duration-200 cursor-pointer h-full hover:shadow-md group">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <PlayCircle className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <div className="font-semibold">Log Progress</div>
                  <div className="text-xs text-muted-foreground">Update tasks</div>
                </div>
              </div>
            </Card>
          </Link>
        </div>
        
        {/* Quick Stats - Enhanced */}
        <div className="grid grid-cols-4 gap-2">
          <Link to="/analytics">
            <Card className="p-2.5 hover:bg-accent/5 transition-all duration-200 cursor-pointer hover:shadow-sm text-center">
              <div className="text-lg font-bold">{todayTasks.length}</div>
              <div className="text-[10px] text-muted-foreground">Tasks</div>
            </Card>
          </Link>
          <Link to="/analytics">
            <Card className="p-2.5 hover:bg-accent/5 transition-all duration-200 cursor-pointer hover:shadow-sm text-center">
              <div className="text-lg font-bold text-success">{completedTasks}</div>
              <div className="text-[10px] text-muted-foreground">Done</div>
            </Card>
          </Link>
          <Link to="/goals">
            <Card className="p-2.5 hover:bg-accent/5 transition-all duration-200 cursor-pointer hover:shadow-sm text-center">
              <div className="text-lg font-bold">{Math.round(stats.avg7Days)}%</div>
              <div className="text-[10px] text-muted-foreground">7-Day</div>
            </Card>
          </Link>
          <Link to="/insights">
            <Card className="p-2.5 hover:bg-accent/5 transition-all duration-200 cursor-pointer hover:shadow-sm text-center">
              <div className="text-lg font-bold flex items-center justify-center gap-1">
                {stats.currentStreak}
                {stats.currentStreak >= 3 && <Flame className="h-3.5 w-3.5 text-warning" />}
              </div>
              <div className="text-[10px] text-muted-foreground">Streak</div>
            </Card>
          </Link>
        </div>

        {/* Best Day Badge */}
        {stats.bestDay && stats.totalDays >= 3 && (
          <Card className="p-3 bg-gradient-to-r from-primary/5 to-accent/5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Award className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">Personal Best</div>
                <div className="text-xs text-muted-foreground">
                  {formatDisplayDate(new Date(stats.bestDay.date))} — {Math.round(stats.bestDay.productivityPercent)}%
                </div>
              </div>
              {productivity > 0 && productivity >= stats.bestDay.productivityPercent && (
                <span className="text-xs font-bold text-success bg-success/10 px-2 py-1 rounded-full">New Record!</span>
              )}
            </div>
          </Card>
        )}

        {/* Active Missions */}
        {missions.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <Rocket className="h-4 w-4 text-primary" />
                Active Missions
              </h2>
              <Link to="/goals" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {missions.map(mission => (
                <Link to="/goals" key={mission.id} className="block">
                  <div className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium truncate flex-1">{mission.title}</span>
                      <span className="text-xs font-bold text-primary ml-2">{mission.progressPercent}%</span>
                    </div>
                    <Progress value={mission.progressPercent} className="h-1.5" />
                    {mission.category && (
                      <div className="mt-1">
                        <span className="text-xs text-muted-foreground capitalize">{mission.category}</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}
        
        {/* Today's Tasks Summary - Enhanced */}
        {hasTasksToday && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Today's Tasks
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-success">{completedTasks} done</span>
                {inProgressTasks > 0 && <span className="text-warning">{inProgressTasks} in progress</span>}
              </div>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {todayTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-accent/5 transition-colors">
                  <div className="flex items-center gap-2 flex-1">
                    <div className={`h-2 w-2 rounded-full ${task.completionPercent === 100 ? 'bg-success' : task.completionPercent > 0 ? 'bg-warning' : 'bg-muted'}`} />
                    <span className={`truncate font-medium ${task.completionPercent === 100 ? 'line-through text-muted-foreground' : ''}`}>{task.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-semibold">{task.weight}%</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${task.completionPercent === 100 ? 'bg-success' : 'bg-gradient-to-r from-primary to-accent'}`}
                          style={{ width: `${task.completionPercent}%` }} 
                        />
                      </div>
                      <span className="text-xs font-medium w-8 text-right">{task.completionPercent}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completion Rate:</span>
                <span className="text-primary font-bold">{Math.round((completedTasks / todayTasks.length) * 100)}%</span>
              </div>
            </div>
          </Card>
        )}
        
        {!hasTasksToday && (
          <Card className="p-6 text-center">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No tasks planned for today</p>
            <Button asChild>
              <Link to="/tasks">Get Started</Link>
            </Button>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
};

export default Index;
