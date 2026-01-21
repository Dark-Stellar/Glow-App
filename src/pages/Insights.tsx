import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { MobileLayout } from "@/components/MobileLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAllDailyReports } from "@/lib/storage";
import { Brain, TrendingUp, Calendar, Award, Target, Sparkles, Lightbulb, BarChart3, RefreshCw, FileText, Zap, BookOpen, MessageCircle, Send, X, Activity, ArrowUp, ArrowDown } from "lucide-react";
import type { DailyReport } from "@/types";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportInsightsPDF } from "@/lib/exportUtils";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, AreaChart, Area, PieChart, Pie } from 'recharts';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const Insights = () => {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [weeklyReview, setWeeklyReview] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [activeAIType, setActiveAIType] = useState<string>("");
  const insightsRef = useRef<HTMLDivElement>(null);
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    loadInsights();
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
  const loadInsights = useCallback(async () => {
    const allReports = await getAllDailyReports();
    setReports(allReports.sort((a, b) => b.date.localeCompare(a.date)));
    setLoading(false);
  }, []);
  
  const bestDayOfWeek = useMemo(() => {
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
    
    return { name: dayNames[bestDay.day], avg: bestDay.avg, dayScores, dayNames };
  }, [reports]);
  
  const topTasks = useMemo(() => {
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
  }, [reports]);
  
  const consistencyScore = useMemo(() => {
    if (reports.length === 0) return 0;
    const oldestDate = new Date(reports[reports.length - 1].date);
    const today = new Date();
    const daysSinceStart = Math.floor((today.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.min(100, Math.round((reports.length / daysSinceStart) * 100));
  }, [reports]);
  
  // This Week vs Average Week comparison
  const weekVsAvgComparison = useMemo(() => {
    if (reports.length < 7) return null;
    
    // This week's average (last 7 days)
    const thisWeek = reports.slice(0, 7);
    const thisWeekAvg = thisWeek.reduce((sum, r) => sum + r.productivityPercent, 0) / thisWeek.length;
    
    // All-time average (excluding this week)
    const olderReports = reports.slice(7);
    if (olderReports.length === 0) return null;
    
    const allTimeAvg = olderReports.reduce((sum, r) => sum + r.productivityPercent, 0) / olderReports.length;
    const change = thisWeekAvg - allTimeAvg;
    
    return { 
      thisWeekAvg, 
      allTimeAvg, 
      change, 
      improving: change > 0,
      thisWeekDays: thisWeek.length,
      totalDays: olderReports.length
    };
  }, [reports]);
  
  const weeklySummary = useMemo(() => {
    const last7 = reports.slice(0, 7);
    if (last7.length === 0) return null;
    const avgProductivity = last7.reduce((sum, r) => sum + r.productivityPercent, 0) / last7.length;
    const bestDay = last7.reduce((best, r) => r.productivityPercent > best.productivityPercent ? r : best, last7[0]);
    const totalTasks = last7.reduce((sum, r) => sum + r.tasks.length, 0);
    const completedTasks = last7.reduce((sum, r) => sum + r.tasks.filter(t => t.completionPercent >= 80).length, 0);
    return { avgProductivity, bestDay, totalTasks, completedTasks, daysTracked: last7.length };
  }, [reports]);
  
  const monthlySummary = useMemo(() => {
    const last30 = reports.slice(0, 30);
    if (last30.length === 0) return null;
    const avgProductivity = last30.reduce((sum, r) => sum + r.productivityPercent, 0) / last30.length;
    const bestDay = last30.reduce((best, r) => r.productivityPercent > best.productivityPercent ? r : best, last30[0]);
    const totalTasks = last30.reduce((sum, r) => sum + r.tasks.length, 0);
    const completedTasks = last30.reduce((sum, r) => sum + r.tasks.filter(t => t.completionPercent >= 80).length, 0);
    const weeks: number[] = [];
    for (let i = 0; i < Math.min(4, Math.ceil(last30.length / 7)); i++) {
      const weekReports = last30.slice(i * 7, (i + 1) * 7);
      if (weekReports.length > 0) {
        weeks.push(weekReports.reduce((sum, r) => sum + r.productivityPercent, 0) / weekReports.length);
      }
    }
    return { avgProductivity, bestDay, totalTasks, completedTasks, daysTracked: last30.length, weeks };
  }, [reports]);
  
  // All 7 days performance
  const allDaysPerformance = useMemo(() => {
    const { dayScores, dayNames } = bestDayOfWeek;
    return dayNames.map((name, idx) => ({
      name,
      shortName: name.substring(0, 3),
      avg: dayScores[idx] ? dayScores[idx].total / dayScores[idx].count : 0,
      count: dayScores[idx]?.count || 0
    }));
  }, [bestDayOfWeek]);

  // Progress Trend Data (last 30 days) - moved from Goals
  const trendData = useMemo(() => {
    const sortedReports = [...reports].sort((a, b) => a.date.localeCompare(b.date));
    const last30 = sortedReports.slice(-30);
    return last30.map(r => ({
      date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      productivity: Math.round(r.productivityPercent)
    }));
  }, [reports]);
  
  // Performance by Day (sorted best to worst) - moved from Goals
  const dayPerformanceData = useMemo(() => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayScores: { [key: number]: { total: number; count: number } } = {};
    
    reports.forEach(r => {
      const day = new Date(r.date).getDay();
      if (!dayScores[day]) dayScores[day] = { total: 0, count: 0 };
      dayScores[day].total += r.productivityPercent;
      dayScores[day].count += 1;
    });
    
    return dayNames.map((name, idx) => ({
      name,
      shortName: name.slice(0, 3),
      avg: dayScores[idx] ? Math.round(dayScores[idx].total / dayScores[idx].count) : 0,
      count: dayScores[idx]?.count || 0
    })).filter(d => d.count > 0).sort((a, b) => b.avg - a.avg);
  }, [reports]);

  // Weekly comparison data for bar chart
  const weeklyComparisonData = useMemo(() => {
    const weeks: { name: string; avg: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const start = i * 7;
      const weekReports = reports.slice(start, start + 7);
      if (weekReports.length > 0) {
        const avg = Math.round(weekReports.reduce((sum, r) => sum + r.productivityPercent, 0) / weekReports.length);
        weeks.push({
          name: i === 0 ? 'This Week' : i === 1 ? '1 Week Ago' : `${i} Weeks Ago`,
          avg
        });
      }
    }
    return weeks;
  }, [reports]);
  
  const getBarColor = (value: number) => {
    if (value >= 80) return 'hsl(142, 76%, 36%)';
    if (value >= 60) return 'hsl(270, 60%, 45%)';
    if (value >= 40) return 'hsl(45, 95%, 55%)';
    return 'hsl(0, 70%, 50%)';
  };
  
  const generateAISuggestions = useCallback(async (type: string = "suggestions") => {
    if (reports.length < 3) {
      toast.error("Need at least 3 days of data for AI insights");
      return;
    }
    
    setLoadingAI(true);
    setActiveAIType(type);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-insights', {
        body: { type }
      });
      
      if (error) throw error;
      
      if (type === "weekly-review") {
        if (data?.grade) {
          setWeeklyReview(data);
          toast.success("Weekly review generated!");
        } else {
          toast.error("Failed to generate weekly review");
        }
      } else if (type === "deep-analysis") {
        if (data?.analysis) {
          setAiAnalysis(data.analysis);
          if (data.recommendations) {
            setAiSuggestions(data.recommendations);
          }
          toast.success("Deep analysis complete!");
        } else {
          toast.error("Failed to generate analysis");
        }
      } else if (data?.suggestions) {
        setAiSuggestions(data.suggestions);
        toast.success("AI insights generated!");
      }
    } catch (error: any) {
      console.error('AI suggestions error:', error);
      if (error?.message?.includes('429')) {
        toast.error("Rate limited. Please try again later.");
      } else if (error?.message?.includes('402')) {
        toast.error("Please add credits to continue using AI features.");
      } else {
        const suggestions = generateRuleBasedSuggestions();
        setAiSuggestions(suggestions);
        toast.info("Generated local insights");
      }
    } finally {
      setLoadingAI(false);
      setActiveAIType("");
    }
  }, [reports]);

  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    
    if (reports.length < 3) {
      toast.error("Need at least 3 days of data for AI chat");
      return;
    }
    
    const userMessage = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-insights', {
        body: { type: 'chat', chatMessage: userMessage }
      });
      
      if (error) throw error;
      
      if (data?.response) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        throw new Error("No response received");
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      if (error?.message?.includes('429')) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: "I'm currently rate limited. Please try again in a moment." }]);
      } else if (error?.message?.includes('402')) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: "Please add credits to continue chatting." }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't process your question. Please try again." }]);
      }
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, reports]);
  
  const generateRuleBasedSuggestions = useCallback(() => {
    const suggestions: string[] = [];
    
    if (consistencyScore < 60) {
      suggestions.push("Try to track your productivity daily for more accurate insights.");
    }
    
    if (weekVsAvgComparison && !weekVsAvgComparison.improving) {
      suggestions.push("Your productivity has dipped recently. Consider reviewing your task priorities.");
    }
    
    const worstDay = allDaysPerformance.reduce((worst, day) => day.avg > 0 && day.avg < worst.avg ? day : worst, allDaysPerformance[0]);
    if (worstDay && worstDay.avg < 50 && worstDay.count > 2) {
      suggestions.push(`${worstDay.name}s tend to be your least productive. Consider lighter tasks on these days.`);
    }
    
    if (suggestions.length === 0) {
      suggestions.push("Great job! Keep maintaining your current habits.");
      suggestions.push(`Your best day is ${bestDayOfWeek.name} - schedule important tasks then.`);
    }
    
    return suggestions;
  }, [consistencyScore, weekVsAvgComparison, allDaysPerformance, bestDayOfWeek]);

  const handleExportPDF = useCallback(async () => {
    try {
      toast.loading("Generating PDF...");
      await exportInsightsPDF(weeklySummary, monthlySummary, allDaysPerformance, topTasks, aiSuggestions, consistencyScore);
      toast.dismiss();
      toast.success("Insights exported as PDF!");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to export PDF");
    }
  }, [weeklySummary, monthlySummary, allDaysPerformance, topTasks, aiSuggestions, consistencyScore]);

  const quickPrompts = [
    { label: "📈 Improve productivity", prompt: "How can I improve my productivity based on my data?" },
    { label: "📅 Best days", prompt: "What are my best performing days and why?" },
    { label: "✅ Task patterns", prompt: "Analyze my task completion patterns and give insights" },
    { label: "🎯 Focus tips", prompt: "Give me personalized tips for better focus based on my history" },
    { label: "⚡ Quick wins", prompt: "What are some quick wins I can implement this week?" },
    { label: "🔄 Weekly plan", prompt: "Help me create a productivity plan for next week" }
  ];
  
  if (loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Analyzing your data...</div>
        </div>
      </MobileLayout>
    );
  }
  
  return (
    <MobileLayout>
      <div className="container max-w-2xl mx-auto p-4 space-y-4" ref={insightsRef}>
        <PageHeader
          title="Insights"
          subtitle="Discover your patterns"
          icon={Brain}
          actions={
            <Button variant="ghost" size="icon" onClick={handleExportPDF} title="Export as PDF">
              <FileText className="h-4 w-4" />
            </Button>
          }
        />

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="trends" className="text-xs">Trends</TabsTrigger>
            <TabsTrigger value="stats" className="text-xs">Stats</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {reports.length < 7 && (
              <Card className="p-4 bg-accent/5">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-accent mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1">Keep Going!</h3>
                    <p className="text-xs text-muted-foreground">
                      Track at least 7 days to unlock deeper insights.
                    </p>
                  </div>
                </div>
              </Card>
            )}
            
            {/* AI Suggestions */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="h-5 w-5 text-accent" />
                <h3 className="font-semibold">AI-Powered Insights</h3>
              </div>
              
              <div className="grid grid-cols-3 gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={() => generateAISuggestions("suggestions")} disabled={loadingAI} className="flex flex-col h-auto py-2">
                  {loadingAI && activeAIType === "suggestions" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mb-1" /><span className="text-xs">Quick Tips</span></>}
                </Button>
                <Button variant="outline" size="sm" onClick={() => generateAISuggestions("deep-analysis")} disabled={loadingAI} className="flex flex-col h-auto py-2">
                  {loadingAI && activeAIType === "deep-analysis" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><Zap className="h-4 w-4 mb-1" /><span className="text-xs">Deep Analysis</span></>}
                </Button>
                <Button variant="outline" size="sm" onClick={() => generateAISuggestions("weekly-review")} disabled={loadingAI} className="flex flex-col h-auto py-2">
                  {loadingAI && activeAIType === "weekly-review" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><BookOpen className="h-4 w-4 mb-1" /><span className="text-xs">Week Review</span></>}
                </Button>
              </div>

              {weeklyReview && (
                <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">{weeklyReview.grade}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Weekly Grade</div>
                      <div className="text-xs text-muted-foreground">Based on your performance</div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {weeklyReview.achievement && (
                      <div className="flex gap-2">
                        <Award className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                        <span>{weeklyReview.achievement}</span>
                      </div>
                    )}
                    {weeklyReview.improvement && (
                      <div className="flex gap-2">
                        <Target className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                        <span>{weeklyReview.improvement}</span>
                      </div>
                    )}
                    {weeklyReview.actionItem && (
                      <div className="flex gap-2">
                        <Zap className="h-4 w-4 text-info flex-shrink-0 mt-0.5" />
                        <span>{weeklyReview.actionItem}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {aiAnalysis && (
                <div className="mb-4 p-3 bg-accent/5 rounded-lg">
                  <p className="text-sm">{aiAnalysis}</p>
                </div>
              )}

              {aiSuggestions.length > 0 ? (
                <div className="space-y-3">
                  {aiSuggestions.map((suggestion, idx) => (
                    <div key={idx} className="flex gap-3 p-3 bg-accent/5 rounded-lg">
                      <div className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-accent">
                        {idx + 1}
                      </div>
                      <p className="text-sm">{suggestion}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Click a button above to get personalized insights.
                </p>
              )}
            </Card>

            {/* AI Chat - Enhanced with better UX */}
            <Card className="p-4 border-primary/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <MessageCircle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Productivity Coach</h3>
                    <p className="text-xs text-muted-foreground">AI-powered insights from your data</p>
                  </div>
                </div>
                {chatMessages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setChatMessages([])}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              
              {/* Quick prompts - Scrollable horizontal */}
              <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-thin">
                {quickPrompts.map((item, idx) => (
                  <Button 
                    key={idx} 
                    variant="outline" 
                    size="sm" 
                    className="text-xs h-8 whitespace-nowrap flex-shrink-0 hover:bg-primary/10 hover:border-primary/30"
                    onClick={() => {
                      setChatInput(item.prompt);
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              
              {/* Chat messages area - Improved styling */}
              <div 
                ref={chatScrollRef} 
                className="h-64 overflow-y-auto space-y-3 mb-3 p-3 bg-gradient-to-b from-muted/20 to-muted/40 rounded-xl border border-border/50"
              >
                {chatMessages.length === 0 && (
                  <div className="text-center text-muted-foreground py-12">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 animate-pulse">
                      <Brain className="h-8 w-8 text-primary/60" />
                    </div>
                    <p className="font-medium">Ask me anything about your productivity!</p>
                    <p className="text-xs mt-2 max-w-[250px] mx-auto">I analyze your daily reports, task patterns, and habits to give personalized advice.</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-1">
                      {quickPrompts.slice(0, 3).map((item, idx) => (
                        <span key={idx} className="text-xs px-2 py-1 bg-muted rounded-full">{item.label}</span>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    <div className={cn(
                      "max-w-[85%] p-3 rounded-2xl text-sm",
                      msg.role === 'user' 
                        ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-br-md' 
                        : 'bg-card border border-border shadow-sm rounded-bl-md'
                    )}>
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-1 mb-1">
                          <Brain className="h-3 w-3 text-primary" />
                          <span className="text-xs font-medium text-primary">Coach</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="bg-card border border-border p-3 rounded-2xl rounded-bl-md shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs text-muted-foreground">Analyzing your data...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Input area - Enhanced */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Ask about your productivity, habits, or goals..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                    disabled={chatLoading}
                    className="pr-10 rounded-xl bg-muted/50 border-border/50 focus:border-primary/50"
                  />
                  {chatInput && (
                    <button
                      onClick={() => setChatInput('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button 
                  size="icon" 
                  onClick={sendChatMessage} 
                  disabled={chatLoading || !chatInput.trim()}
                  className="rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Data context indicator */}
              <div className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Activity className="h-3 w-3" />
                <span>Analyzing {reports.length} days of productivity data</span>
              </div>
            </Card>
            
            {/* Weekly Summary */}
            {weeklySummary && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-5 w-5 text-info" />
                  <h3 className="font-semibold">This Week</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">{Math.round(weeklySummary.avgProductivity)}%</div>
                    <div className="text-xs text-muted-foreground">Avg Productivity</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{weeklySummary.daysTracked}</div>
                    <div className="text-xs text-muted-foreground">Days Tracked</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{weeklySummary.completedTasks}</div>
                    <div className="text-xs text-muted-foreground">Tasks Completed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-success">{Math.round(weeklySummary.bestDay.productivityPercent)}%</div>
                    <div className="text-xs text-muted-foreground">Best Day</div>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Trends Tab - Moved from Goals */}
          <TabsContent value="trends" className="space-y-4 mt-4">
            {/* Progress Trend Chart */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">30-Day Progress Trend</h3>
              </div>
              {trendData.length > 0 ? (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorProductivity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(270, 60%, 45%)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(270, 60%, 45%)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        formatter={(value: number) => [`${value}%`, 'Productivity']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="productivity" 
                        stroke="hsl(270, 60%, 45%)" 
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorProductivity)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-52 flex items-center justify-center text-muted-foreground">
                  No data available yet
                </div>
              )}
            </Card>

            {/* Weekly Comparison */}
            {weeklyComparisonData.length > 1 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-info" />
                  <h3 className="font-semibold">Weekly Comparison</h3>
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        formatter={(value: number) => [`${value}%`, 'Avg']}
                      />
                      <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                        {weeklyComparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getBarColor(entry.avg)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
            
            {/* Performance by Day */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Performance by Day</h3>
                <span className="text-xs text-muted-foreground ml-auto">Best → Worst</span>
              </div>
              {dayPerformanceData.length > 0 ? (
                <>
                  <div className="h-48 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dayPerformanceData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="shortName" tick={{ fontSize: 10 }} width={40} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                          formatter={(value: number) => [`${value}%`, 'Avg Productivity']}
                        />
                        <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                          {dayPerformanceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getBarColor(entry.avg)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Detailed List */}
                  <div className="space-y-2">
                    {dayPerformanceData.map((day, idx) => (
                      <div key={day.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white",
                            idx === 0 ? "bg-success" : idx === dayPerformanceData.length - 1 ? "bg-destructive" : "bg-muted-foreground"
                          )}>
                            {idx + 1}
                          </span>
                          <span className="font-medium">{day.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{day.count} days</span>
                          <span className={cn("font-bold", day.avg >= 70 ? 'text-success' : day.avg >= 50 ? 'text-primary' : 'text-destructive')}>
                            {day.avg}%
                          </span>
                          {idx === 0 && <ArrowUp className="h-4 w-4 text-success" />}
                          {idx === dayPerformanceData.length - 1 && <ArrowDown className="h-4 w-4 text-destructive" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  No data available yet
                </div>
              )}
            </Card>

            {/* This Week vs Average Week Comparison */}
            {weekVsAvgComparison && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className={`h-5 w-5 ${weekVsAvgComparison.improving ? 'text-success' : 'text-destructive'}`} />
                  <h3 className="font-semibold">This Week vs Average</h3>
                </div>
                
                {/* Visual Comparison */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-3 rounded-lg bg-primary/10">
                    <div className="text-2xl font-bold text-primary">{Math.round(weekVsAvgComparison.thisWeekAvg)}%</div>
                    <div className="text-xs text-muted-foreground">This Week</div>
                    <div className="text-xs text-muted-foreground">({weekVsAvgComparison.thisWeekDays} days)</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">{Math.round(weekVsAvgComparison.allTimeAvg)}%</div>
                    <div className="text-xs text-muted-foreground">All-Time Avg</div>
                    <div className="text-xs text-muted-foreground">({weekVsAvgComparison.totalDays} days)</div>
                  </div>
                </div>
                
                {/* Comparison Bar Visualization */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-16">This Week</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                        style={{ width: `${weekVsAvgComparison.thisWeekAvg}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold w-10 text-right">{Math.round(weekVsAvgComparison.thisWeekAvg)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-16">Average</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-muted-foreground/40 rounded-full transition-all duration-500"
                        style={{ width: `${weekVsAvgComparison.allTimeAvg}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold w-10 text-right">{Math.round(weekVsAvgComparison.allTimeAvg)}%</span>
                  </div>
                </div>
                
                {/* Change Indicator */}
                <div className={`flex items-center gap-2 p-3 rounded-lg ${weekVsAvgComparison.improving ? 'bg-success/10' : 'bg-destructive/10'}`}>
                  {weekVsAvgComparison.improving ? (
                    <ArrowUp className="h-5 w-5 text-success" />
                  ) : (
                    <ArrowDown className="h-5 w-5 text-destructive" />
                  )}
                  <span className={`text-xl font-bold ${weekVsAvgComparison.improving ? 'text-success' : 'text-destructive'}`}>
                    {weekVsAvgComparison.improving ? '+' : ''}{Math.round(weekVsAvgComparison.change)}%
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {weekVsAvgComparison.improving ? 'above' : 'below'} your average
                  </span>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-4 mt-4">
            {/* Monthly Summary */}
            {monthlySummary && monthlySummary.daysTracked > 7 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Monthly Overview</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-bold">{Math.round(monthlySummary.avgProductivity)}%</div>
                      <div className="text-xs text-muted-foreground">Avg Productivity</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{monthlySummary.daysTracked}</div>
                      <div className="text-xs text-muted-foreground">Days Tracked</div>
                    </div>
                  </div>
                  {monthlySummary.weeks.length > 1 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">Weekly Trend</div>
                      <div className="flex gap-1">
                        {monthlySummary.weeks.map((week, idx) => (
                          <div key={idx} className="flex-1">
                            <div className="bg-primary/20 rounded-t" style={{ height: `${Math.max(4, week * 0.6)}px` }} />
                            <div className="text-xs text-center mt-1 text-muted-foreground">W{idx + 1}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
            
            {/* Best Days */}
            {reports.length >= 7 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Award className="h-5 w-5 text-success" />
                  <h3 className="font-semibold">Performance by Weekday</h3>
                </div>
                <div className="space-y-2">
                  {allDaysPerformance.map((day) => (
                    <div key={day.name} className="flex items-center gap-3">
                      <div className="w-10 text-sm font-medium">{day.shortName}</div>
                      <div className="flex-1">
                        <Progress value={day.avg} className="h-2" />
                      </div>
                      <div className="w-14 text-sm text-right font-medium">
                        {day.count > 0 ? `${Math.round(day.avg)}%` : '-'}
                      </div>
                      <div className="w-8 text-xs text-muted-foreground text-right">
                        ({day.count})
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            
            {/* Top Tasks */}
            {topTasks.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-5 w-5 text-info" />
                  <h3 className="font-semibold">Top Performing Tasks</h3>
                </div>
                <div className="space-y-2">
                  {topTasks.map((task, idx) => (
                    <div key={task.title} className="flex items-center gap-3">
                      <div className="h-6 w-6 rounded-full bg-info/10 flex items-center justify-center text-xs font-bold text-info">
                        {idx + 1}
                      </div>
                      <div className="flex-1 truncate text-sm">{task.title}</div>
                      <div className="text-sm font-medium">{Math.round(task.avg)}%</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            
            {/* Consistency Score */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-5 w-5 text-warning" />
                <h3 className="font-semibold">Consistency Score</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Daily tracking</span>
                  <span className="font-bold">{consistencyScore}%</span>
                </div>
                <Progress value={consistencyScore} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {consistencyScore >= 80 ? "Excellent tracking consistency!" : consistencyScore >= 60 ? "Good consistency, keep it up!" : "Try to track daily for better insights."}
                </p>
              </div>
            </Card>

            {/* Streak & Days Stats */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-5 w-5 text-accent" />
                <h3 className="font-semibold">Your Journey</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{reports.length}</div>
                  <div className="text-xs text-muted-foreground">Total Days Tracked</div>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-accent">
                    {reports.length > 0 ? Math.round(reports.reduce((sum, r) => sum + r.productivityPercent, 0) / reports.length) : 0}%
                  </div>
                  <div className="text-xs text-muted-foreground">Lifetime Average</div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
};

export default Insights;
