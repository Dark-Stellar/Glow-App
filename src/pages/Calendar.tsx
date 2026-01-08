import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, TrendingUp, TrendingDown, BarChart3, Target, Flame } from "lucide-react";
import { MobileLayout } from "@/components/MobileLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getAllDailyReports } from "@/lib/storage";
import { getMonthDays, formatDate, isToday } from "@/lib/dates";
import { format, addMonths, subMonths, addWeeks, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import type { DailyReport } from "@/types";
import { cn } from "@/lib/utils";

type ViewMode = 'month' | 'week';

const Calendar = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [reports, setReports] = useState<Record<string, DailyReport>>({});
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadReports();
  }, []);
  
  const loadReports = useCallback(async () => {
    const allReports = await getAllDailyReports();
    const reportsMap: Record<string, DailyReport> = {};
    allReports.forEach(report => {
      reportsMap[report.date] = report;
    });
    setReports(reportsMap);
    setLoading(false);
  }, []);
  
  const monthDays = useMemo(() => getMonthDays(currentDate), [currentDate]);
  
  const weekDays = useMemo(() => eachDayOfInterval({
    start: startOfWeek(currentDate),
    end: endOfWeek(currentDate)
  }), [currentDate]);

  // Monthly statistics
  const monthStats = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const monthReports = Object.values(reports).filter(r => {
      const reportDate = new Date(r.date);
      return reportDate >= monthStart && reportDate <= monthEnd;
    });
    
    if (monthReports.length === 0) return null;
    
    const avgProductivity = monthReports.reduce((sum, r) => sum + r.productivityPercent, 0) / monthReports.length;
    const bestDay = monthReports.reduce((best, r) => r.productivityPercent > best.productivityPercent ? r : best);
    const worstDay = monthReports.reduce((worst, r) => r.productivityPercent < worst.productivityPercent ? r : worst);
    const totalTasks = monthReports.reduce((sum, r) => sum + r.tasks.length, 0);
    const completedTasks = monthReports.reduce((sum, r) => sum + r.tasks.filter(t => t.completionPercent >= 80).length, 0);
    
    // Calculate streak within month
    let currentStreak = 0;
    const sortedReports = monthReports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    for (let i = 0; i < sortedReports.length; i++) {
      if (sortedReports[i].productivityPercent >= 60) currentStreak++;
      else break;
    }
    
    // Compare with previous month
    const prevMonthStart = startOfMonth(subMonths(currentDate, 1));
    const prevMonthEnd = endOfMonth(subMonths(currentDate, 1));
    const prevMonthReports = Object.values(reports).filter(r => {
      const reportDate = new Date(r.date);
      return reportDate >= prevMonthStart && reportDate <= prevMonthEnd;
    });
    const prevAvg = prevMonthReports.length > 0 
      ? prevMonthReports.reduce((sum, r) => sum + r.productivityPercent, 0) / prevMonthReports.length 
      : null;
    
    return {
      avgProductivity,
      bestDay,
      worstDay,
      totalTasks,
      completedTasks,
      daysTracked: monthReports.length,
      currentStreak,
      prevAvg,
      trend: prevAvg ? avgProductivity - prevAvg : null
    };
  }, [reports, currentDate]);

  // Weekly statistics
  const weekStats = useMemo(() => {
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);
    const weekReports = Object.values(reports).filter(r => {
      const reportDate = new Date(r.date);
      return reportDate >= weekStart && reportDate <= weekEnd;
    });
    
    if (weekReports.length === 0) return null;
    
    const avgProductivity = weekReports.reduce((sum, r) => sum + r.productivityPercent, 0) / weekReports.length;
    const totalTasks = weekReports.reduce((sum, r) => sum + r.tasks.length, 0);
    const completedTasks = weekReports.reduce((sum, r) => sum + r.tasks.filter(t => t.completionPercent >= 80).length, 0);
    
    return {
      avgProductivity,
      totalTasks,
      completedTasks,
      daysTracked: weekReports.length
    };
  }, [reports, currentDate]);
  
  const getProductivityColor = useCallback((productivity: number) => {
    if (productivity >= 80) return "bg-success";
    if (productivity >= 60) return "bg-primary";
    if (productivity >= 40) return "bg-warning";
    return "bg-destructive";
  }, []);
  
  const getProductivityLabel = useCallback((productivity: number) => {
    if (productivity >= 80) return "Excellent";
    if (productivity >= 60) return "Good";
    if (productivity >= 40) return "Fair";
    return "Needs Work";
  }, []);
  
  const goToPrev = useCallback(() => {
    if (viewMode === 'month') {
      setCurrentDate(prev => subMonths(prev, 1));
    } else {
      setCurrentDate(prev => subWeeks(prev, 1));
    }
  }, [viewMode]);
  
  const goToNext = useCallback(() => {
    if (viewMode === 'month') {
      setCurrentDate(prev => addMonths(prev, 1));
    } else {
      setCurrentDate(prev => addWeeks(prev, 1));
    }
  }, [viewMode]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);
  
  const renderDayCell = useCallback((day: Date, isWeekView: boolean = false) => {
    const dateStr = formatDate(day);
    const report = reports[dateStr];
    const hasReport = !!report;
    const isTodayDate = isToday(day);
    const isCurrentMonth = isSameMonth(day, currentDate);
    
    const cellContent = (
      <button
        onClick={() => navigate(`/day/${dateStr}`)}
        className={cn(
          "rounded-lg flex flex-col items-center justify-center relative transition-all duration-200 cursor-pointer hover:bg-accent/10 hover:shadow-sm",
          isWeekView ? "p-4 min-h-[120px] w-full" : "aspect-square",
          isTodayDate && "ring-2 ring-primary",
          !hasReport && "text-muted-foreground",
          !isCurrentMonth && !isWeekView && "opacity-40"
        )}
      >
        <div className={cn("font-medium", isWeekView ? "text-lg mb-2" : "text-sm")}>{format(day, "d")}</div>
        {isWeekView && (
          <div className="text-xs text-muted-foreground mb-2">{format(day, "EEE")}</div>
        )}
        {hasReport && (
          <>
            <div className={cn(
              "rounded-full",
              isWeekView ? "w-3 h-3 mb-1" : "w-1.5 h-1.5 mt-0.5",
              getProductivityColor(report.productivityPercent)
            )} />
            <div className={cn("font-semibold", isWeekView ? "text-lg" : "text-[10px] mt-0.5")}>
              {Math.round(report.productivityPercent)}%
            </div>
            {isWeekView && (
              <>
                <div className={cn("text-xs mt-1", getProductivityColor(report.productivityPercent).replace('bg-', 'text-'))}>
                  {getProductivityLabel(report.productivityPercent)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {report.tasks.length} tasks
                </div>
              </>
            )}
          </>
        )}
      </button>
    );
    
    if (hasReport && !isWeekView) {
      return (
        <Tooltip key={dateStr}>
          <TooltipTrigger asChild>
            {cellContent}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-2 p-1">
              <div className="font-semibold">{format(day, "MMM d, yyyy")}</div>
              <div className="text-sm">
                <span className={cn("font-bold", getProductivityColor(report.productivityPercent).replace('bg-', 'text-'))}>
                  {Math.round(report.productivityPercent)}%
                </span>
                <span className="text-muted-foreground ml-1">productivity</span>
              </div>
              <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                <div className="font-medium mb-1">Tasks ({report.tasks.length}):</div>
                {report.tasks.slice(0, 3).map((task, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <span className="truncate">{task.title}</span>
                    <span className="flex-shrink-0">{task.completionPercent}%</span>
                  </div>
                ))}
                {report.tasks.length > 3 && (
                  <div className="text-muted-foreground mt-1">+{report.tasks.length - 3} more</div>
                )}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }
    
    return <div key={dateStr}>{cellContent}</div>;
  }, [reports, navigate, getProductivityColor, getProductivityLabel, currentDate]);
  
  if (loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </MobileLayout>
    );
  }
  
  const stats = viewMode === 'month' ? monthStats : weekStats;
  
  return (
    <MobileLayout>
      <div className="w-full max-w-lg mx-auto px-4 py-3 space-y-3">
        <PageHeader
          title="Calendar"
          subtitle="View your daily reports"
          icon={CalendarIcon}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday} className="text-xs h-8">
                Today
              </Button>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <TabsList className="grid grid-cols-2 h-8">
                  <TabsTrigger value="month" className="gap-1 text-xs px-2">
                    <CalendarIcon className="h-3 w-3" />
                    Month
                  </TabsTrigger>
                  <TabsTrigger value="week" className="gap-1 text-xs px-2">
                    <List className="h-3 w-3" />
                    Week
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          }
        />

        {/* Statistics Card */}
        {stats && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">{viewMode === 'month' ? 'Monthly' : 'Weekly'} Stats</h3>
              </div>
              {viewMode === 'month' && monthStats?.trend !== null && (
                <div className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded-full",
                  monthStats.trend >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                )}>
                  {monthStats.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {monthStats.trend >= 0 ? '+' : ''}{Math.round(monthStats.trend)}%
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center">
                <div className="text-xl font-bold text-primary">{Math.round(stats.avgProductivity)}%</div>
                <div className="text-xs text-muted-foreground">Avg</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold">{stats.daysTracked}</div>
                <div className="text-xs text-muted-foreground">Days</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-success">{stats.completedTasks}</div>
                <div className="text-xs text-muted-foreground">Done</div>
              </div>
            </div>
            
            {viewMode === 'month' && monthStats && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Target className="h-3 w-3" /> Best Day
                  </span>
                  <span className="font-medium text-success">
                    {format(new Date(monthStats.bestDay.date), 'MMM d')} - {Math.round(monthStats.bestDay.productivityPercent)}%
                  </span>
                </div>
                {monthStats.currentStreak > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Flame className="h-3 w-3" /> Streak
                    </span>
                    <span className="font-medium text-warning">{monthStats.currentStreak} days</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Completion Rate</span>
                <span>{stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%</span>
              </div>
              <Progress value={stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0} className="h-2" />
            </div>
          </Card>
        )}
        
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={goToPrev}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold">
              {viewMode === 'month' 
                ? format(currentDate, "MMMM yyyy")
                : `${format(startOfWeek(currentDate), "MMM d")} - ${format(endOfWeek(currentDate), "MMM d, yyyy")}`
              }
            </h2>
            <Button variant="ghost" size="icon" onClick={goToNext}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          
          {viewMode === 'month' ? (
            <>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => (
                  <div key={day} className="text-center text-xs text-muted-foreground font-medium p-2">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: monthDays[0].getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                {monthDays.map(day => renderDayCell(day, false))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map(day => renderDayCell(day, true))}
            </div>
          )}
        </Card>
        
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-gradient-to-br from-primary to-accent" />
            Legend
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-success/5 border border-success/20">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span className="text-success font-medium">80%+ Excellent</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-primary font-medium">60-79% Good</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/5 border border-warning/20">
              <div className="w-3 h-3 rounded-full bg-warning" />
              <span className="text-warning font-medium">40-59% Fair</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/20">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <span className="text-destructive font-medium">&lt;40% Needs Work</span>
            </div>
          </div>
          
          {/* Quick Tips */}
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> Tap any day to view or edit your report. Hover for quick preview.
            </p>
          </div>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default Calendar;