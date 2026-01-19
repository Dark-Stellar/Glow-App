import { useEffect, useState, useCallback, useMemo } from "react";
import { MobileLayout } from "@/components/MobileLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { getAllDailyReports } from "@/lib/storage";
import { Target, Plus, Trash2, TrendingUp, Rocket, Edit2, Check, X, Calculator, Activity, Heart, Scale, Droplets, Moon, Dumbbell, Apple } from "lucide-react";
import { toast } from "sonner";
import type { ProductivityGoal, Mission, DailyReport } from "@/types";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const MISSION_CATEGORIES = [
  { value: 'personal', label: 'Personal' },
  { value: 'career', label: 'Career' },
  { value: 'health', label: 'Health' },
  { value: 'learning', label: 'Learning' },
  { value: 'financial', label: 'Financial' },
  { value: 'creative', label: 'Creative' },
  { value: 'social', label: 'Social' },
  { value: 'other', label: 'Other' },
];

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', multiplier: 1.2 },
  { value: 'light', label: 'Light (1-3 days/week)', multiplier: 1.375 },
  { value: 'moderate', label: 'Moderate (3-5 days/week)', multiplier: 1.55 },
  { value: 'active', label: 'Active (6-7 days/week)', multiplier: 1.725 },
  { value: 'very_active', label: 'Very Active (athlete)', multiplier: 1.9 },
];

const Goals = () => {
  const [goals, setGoals] = useState<ProductivityGoal[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showMissionForm, setShowMissionForm] = useState(false);
  const [goalType, setGoalType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [targetPercentage, setTargetPercentage] = useState(75);
  
  const [missionTitle, setMissionTitle] = useState('');
  const [missionDescription, setMissionDescription] = useState('');
  const [missionCategory, setMissionCategory] = useState('personal');
  const [missionTargetDate, setMissionTargetDate] = useState('');
  
  const [editingMission, setEditingMission] = useState<string | null>(null);
  const [editProgress, setEditProgress] = useState(0);
  const [progressData, setProgressData] = useState<{ [key: string]: number }>({});
  
  // BMI Calculator State
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [activityLevel, setActivityLevel] = useState('sedentary');
  const [bmiResult, setBmiResult] = useState<{ bmi: number; bmr: number; tdee: number; category: string } | null>(null);
  const [healthHistory, setHealthHistory] = useState<any[]>([]);
  const [notes, setNotes] = useState('');

  // Additional health tracking
  const [waterIntake, setWaterIntake] = useState(0);
  const [sleepHours, setSleepHours] = useState('');
  const [steps, setSteps] = useState('');
  const [calories, setCalories] = useState('');
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const [goalsRes, missionsRes, reportsData, healthRes] = await Promise.all([
      supabase.from('productivity_goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('missions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      getAllDailyReports(),
      supabase.from('health_tracking').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(30)
    ]);
    
    if (goalsRes.data) {
      setGoals(goalsRes.data.map(g => ({
        id: g.id,
        goalType: g.goal_type as 'daily' | 'weekly' | 'monthly',
        targetPercentage: g.target_percentage,
        startDate: g.start_date,
        endDate: g.end_date,
        createdAt: g.created_at
      })));
    }
    
    if (missionsRes.data) {
      setMissions(missionsRes.data.map(m => ({
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
    
    setReports(reportsData.sort((a, b) => a.date.localeCompare(b.date)));
    
    if (healthRes.data) {
      setHealthHistory(healthRes.data);
      if (healthRes.data.length > 0) {
        const latest = healthRes.data[0];
        setWeight(String(latest.weight_kg));
        setHeight(String(latest.height_cm));
        setAge(String(latest.age));
        setGender(latest.gender as 'male' | 'female');
        setActivityLevel(latest.activity_level);
      }
    }
    
    setLoading(false);
  }, []);
  
  useEffect(() => {
    const loadProgress = async () => {
      const data: { [key: string]: number } = {};
      for (const goal of goals) {
        const relevantReports = reports.filter(r => r.date >= goal.startDate && r.date <= goal.endDate);
        data[goal.id] = relevantReports.length > 0 ? relevantReports.reduce((sum, r) => sum + r.productivityPercent, 0) / relevantReports.length : 0;
      }
      setProgressData(data);
    };
    if (goals.length > 0) loadProgress();
  }, [goals, reports]);

  // Weight trend data
  const weightTrendData = useMemo(() => {
    return healthHistory.slice().reverse().map(record => ({
      date: new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weight: record.weight_kg,
      bmi: record.bmi
    }));
  }, [healthHistory]);

  // Ideal weight calculation
  const idealWeight = useMemo(() => {
    const h = parseFloat(height);
    if (!h) return null;
    const heightM = h / 100;
    const minWeight = Math.round(18.5 * heightM * heightM);
    const maxWeight = Math.round(24.9 * heightM * heightM);
    return { min: minWeight, max: maxWeight };
  }, [height]);
  
  // Calculate BMI
  const calculateBmi = useCallback(() => {
    const w = parseFloat(weight);
    const h = parseFloat(height) / 100;
    const a = parseInt(age);
    
    if (!w || !h || !a || w <= 0 || h <= 0 || a <= 0) {
      toast.error('Please enter valid values');
      return;
    }
    
    const bmi = w / (h * h);
    
    let bmr;
    if (gender === 'male') {
      bmr = 10 * w + 6.25 * parseFloat(height) - 5 * a + 5;
    } else {
      bmr = 10 * w + 6.25 * parseFloat(height) - 5 * a - 161;
    }
    
    const multiplier = ACTIVITY_LEVELS.find(l => l.value === activityLevel)?.multiplier || 1.2;
    const tdee = bmr * multiplier;
    
    let category = '';
    if (bmi < 18.5) category = 'Underweight';
    else if (bmi < 25) category = 'Normal';
    else if (bmi < 30) category = 'Overweight';
    else category = 'Obese';
    
    setBmiResult({ bmi: Math.round(bmi * 10) / 10, bmr: Math.round(bmr), tdee: Math.round(tdee), category });
  }, [weight, height, age, gender, activityLevel]);
  
  // Save BMI to database
  const saveBmiRecord = useCallback(async () => {
    if (!bmiResult) {
      toast.error('Calculate BMI first');
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please login to save');
      return;
    }
    
    const { error } = await supabase.from('health_tracking').insert({
      user_id: user.id,
      weight_kg: parseFloat(weight),
      height_cm: parseFloat(height),
      age: parseInt(age),
      gender,
      activity_level: activityLevel,
      bmi: bmiResult.bmi,
      bmr: bmiResult.bmr,
      notes: notes || null
    });
    
    if (error) {
      toast.error('Failed to save record');
    } else {
      toast.success('Health record saved!');
      setBmiResult(null);
      setNotes('');
      loadData();
    }
  }, [bmiResult, weight, height, age, gender, activityLevel, notes, loadData]);
  
  const createGoal = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    let endDate: string;
    
    if (goalType === 'daily') {
      endDate = startDate;
    } else if (goalType === 'weekly') {
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      endDate = end.toISOString().split('T')[0];
    } else {
      const end = new Date(today);
      end.setMonth(end.getMonth() + 1);
      endDate = end.toISOString().split('T')[0];
    }
    
    const { error } = await supabase.from('productivity_goals').insert({
      user_id: user.id,
      goal_type: goalType,
      target_percentage: targetPercentage,
      start_date: startDate,
      end_date: endDate
    });
    
    if (error) {
      toast.error('Failed to create goal');
    } else {
      toast.success('Goal created!');
      setShowGoalForm(false);
      loadData();
    }
  }, [goalType, targetPercentage, loadData]);
  
  const deleteGoal = useCallback(async (id: string) => {
    const { error } = await supabase.from('productivity_goals').delete().eq('id', id);
    if (error) toast.error('Failed to delete goal');
    else { toast.success('Goal deleted'); loadData(); }
  }, [loadData]);
  
  const createMission = useCallback(async () => {
    if (!missionTitle.trim()) { toast.error('Mission title is required'); return; }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { error } = await supabase.from('missions').insert({
      user_id: user.id,
      title: missionTitle.trim(),
      description: missionDescription.trim() || null,
      category: missionCategory,
      target_date: missionTargetDate || null,
      progress_percent: 0,
      is_completed: false
    });
    
    if (error) toast.error('Failed to create mission');
    else {
      toast.success('Mission created!');
      setShowMissionForm(false);
      setMissionTitle('');
      setMissionDescription('');
      setMissionCategory('personal');
      setMissionTargetDate('');
      loadData();
    }
  }, [missionTitle, missionDescription, missionCategory, missionTargetDate, loadData]);
  
  const updateMissionProgress = useCallback(async (id: string, progress: number) => {
    const isCompleted = progress >= 100;
    const { error } = await supabase.from('missions').update({ 
      progress_percent: Math.min(100, Math.max(0, progress)),
      is_completed: isCompleted,
      updated_at: new Date().toISOString()
    }).eq('id', id);
    
    if (error) toast.error('Failed to update progress');
    else { if (isCompleted) toast.success('Mission completed! 🎉'); setEditingMission(null); loadData(); }
  }, [loadData]);
  
  const deleteMission = useCallback(async (id: string) => {
    const { error } = await supabase.from('missions').delete().eq('id', id);
    if (error) toast.error('Failed to delete mission');
    else { toast.success('Mission deleted'); loadData(); }
  }, [loadData]);
  
  const activeMissions = useMemo(() => missions.filter(m => !m.isCompleted), [missions]);
  const completedMissions = useMemo(() => missions.filter(m => m.isCompleted), [missions]);
  
  const getBmiColor = (category: string) => {
    switch (category) {
      case 'Underweight': return 'text-warning';
      case 'Normal': return 'text-success';
      case 'Overweight': return 'text-warning';
      case 'Obese': return 'text-destructive';
      default: return '';
    }
  };

  const addWater = useCallback(() => {
    setWaterIntake(prev => Math.min(prev + 1, 12));
    toast.success(`${waterIntake + 1} glasses logged!`);
  }, [waterIntake]);
  
  if (loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </MobileLayout>
    );
  }
  
  return (
    <MobileLayout>
      <div className="container max-w-2xl mx-auto p-4 space-y-4">
        <PageHeader title="Goals & Health" subtitle="Set targets and track wellness" icon={Target} />
        
        <Tabs defaultValue="goals" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="goals" className="text-xs">Goals</TabsTrigger>
            <TabsTrigger value="missions" className="text-xs">Missions</TabsTrigger>
            <TabsTrigger value="health" className="text-xs">Health</TabsTrigger>
          </TabsList>
          
          {/* Goals Tab */}
          <TabsContent value="goals" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowGoalForm(!showGoalForm)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Goal
              </Button>
            </div>
            
            {showGoalForm && (
              <Card className="p-4 space-y-4">
                <h3 className="font-semibold">Create New Goal</h3>
                <div className="space-y-2">
                  <Label>Goal Type</Label>
                  <Select value={goalType} onValueChange={(v) => setGoalType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Productivity (%)</Label>
                  <Input type="number" min="0" max="100" value={targetPercentage} onChange={(e) => setTargetPercentage(Math.max(0, Math.min(100, Number(e.target.value))))} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={createGoal} className="flex-1">Create Goal</Button>
                  <Button onClick={() => setShowGoalForm(false)} variant="outline">Cancel</Button>
                </div>
              </Card>
            )}
            
            <div className="space-y-3">
              {goals.length === 0 && !showGoalForm && (
                <Card className="p-6 text-center">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground mb-4">No goals yet</p>
                  <Button onClick={() => setShowGoalForm(true)}><Plus className="h-4 w-4 mr-2" />Create Your First Goal</Button>
                </Card>
              )}
              
              {goals.map((goal) => {
                const progress = progressData[goal.id] || 0;
                const isAchieved = progress >= goal.targetPercentage;
                const daysLeft = Math.ceil((new Date(goal.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                const isActive = daysLeft >= 0;
                
                return (
                  <Card key={goal.id} className={cn("p-4", isAchieved && "border-success")}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", isAchieved ? 'bg-success/10' : 'bg-primary/10')}>
                          {isAchieved ? <TrendingUp className="h-5 w-5 text-success" /> : <Target className="h-5 w-5 text-primary" />}
                        </div>
                        <div>
                          <h3 className="font-semibold capitalize">{goal.goalType} Goal</h3>
                          <p className="text-xs text-muted-foreground">{new Date(goal.startDate).toLocaleDateString()} - {new Date(goal.endDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteGoal(goal.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Target: {goal.targetPercentage}%</span>
                        <span className={cn("font-bold", isAchieved && 'text-success')}>Current: {Math.round(progress)}%</span>
                      </div>
                      <Progress value={(progress / goal.targetPercentage) * 100} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{isActive ? (daysLeft === 0 ? 'Ends today' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`) : 'Expired'}</span>
                        {isAchieved && <span className="text-success font-semibold">✓ Achieved!</span>}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
          
          {/* Missions Tab */}
          <TabsContent value="missions" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowMissionForm(!showMissionForm)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Mission
              </Button>
            </div>
            
            {showMissionForm && (
              <Card className="p-4 space-y-4">
                <h3 className="font-semibold">Create New Mission</h3>
                <div className="space-y-2">
                  <Label>Mission Title *</Label>
                  <Input placeholder="e.g., Learn Spanish..." value={missionTitle} onChange={(e) => setMissionTitle(e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea placeholder="Describe your mission..." value={missionDescription} onChange={(e) => setMissionDescription(e.target.value)} maxLength={500} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={missionCategory} onValueChange={setMissionCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MISSION_CATEGORIES.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Date</Label>
                    <Input type="date" value={missionTargetDate} onChange={(e) => setMissionTargetDate(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={createMission} className="flex-1">Create Mission</Button>
                  <Button onClick={() => setShowMissionForm(false)} variant="outline">Cancel</Button>
                </div>
              </Card>
            )}
            
            <div className="space-y-3">
              {missions.length === 0 && !showMissionForm && (
                <Card className="p-6 text-center">
                  <Rocket className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground mb-2">No missions yet</p>
                  <p className="text-xs text-muted-foreground mb-4">Create a mission to track any goal with a progress bar</p>
                  <Button onClick={() => setShowMissionForm(true)}><Plus className="h-4 w-4 mr-2" />Create Your First Mission</Button>
                </Card>
              )}
              
              {activeMissions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Active Missions</h3>
                  <div className="space-y-3">
                    {activeMissions.map(mission => (
                      <Card key={mission.id} className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                              <Rocket className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold">{mission.title}</h3>
                              <p className="text-xs text-muted-foreground capitalize">{mission.category}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {editingMission === mission.id ? (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => updateMissionProgress(mission.id, editProgress)}><Check className="h-4 w-4 text-success" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => setEditingMission(null)}><X className="h-4 w-4" /></Button>
                              </>
                            ) : (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => { setEditingMission(mission.id); setEditProgress(mission.progressPercent); }}><Edit2 className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteMission(mission.id)}><Trash2 className="h-4 w-4" /></Button>
                              </>
                            )}
                          </div>
                        </div>
                        {mission.description && <p className="text-sm text-muted-foreground mb-3">{mission.description}</p>}
                        <div className="space-y-2">
                          {editingMission === mission.id ? (
                            <div className="space-y-2">
                              <Slider value={[editProgress]} min={0} max={100} step={5} onValueChange={([v]) => setEditProgress(v)} />
                              <div className="text-center font-bold text-primary">{editProgress}%</div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-bold text-primary">{mission.progressPercent}%</span>
                              </div>
                              <Progress value={mission.progressPercent} className="h-2" />
                            </>
                          )}
                          {mission.targetDate && (
                            <div className="text-xs text-muted-foreground">Target: {new Date(mission.targetDate).toLocaleDateString()}</div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              
              {completedMissions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Completed</h3>
                  <div className="space-y-3">
                    {completedMissions.map(mission => (
                      <Card key={mission.id} className="p-4 border-success/50 bg-success/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-success/20 flex items-center justify-center">
                              <Check className="h-4 w-4 text-success" />
                            </div>
                            <div>
                              <h3 className="font-semibold line-through opacity-70">{mission.title}</h3>
                              <p className="text-xs text-muted-foreground capitalize">{mission.category}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => deleteMission(mission.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          
          {/* Health Tab - Enhanced */}
          <TabsContent value="health" className="space-y-4 mt-4">
            {/* Quick Health Actions */}
            <div className="grid grid-cols-4 gap-2">
              <Card className="p-3 text-center cursor-pointer hover:bg-accent/10 transition-colors" onClick={addWater}>
                <Droplets className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <div className="text-xs font-medium">{waterIntake}/8</div>
                <div className="text-[10px] text-muted-foreground">Water</div>
              </Card>
              <Card className="p-3 text-center">
                <Moon className="h-5 w-5 mx-auto mb-1 text-indigo-500" />
                <Input 
                  type="number" 
                  placeholder="0" 
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                  className="h-6 text-xs text-center p-0 border-0 bg-transparent"
                />
                <div className="text-[10px] text-muted-foreground">Sleep (hrs)</div>
              </Card>
              <Card className="p-3 text-center">
                <Dumbbell className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                <Input 
                  type="number" 
                  placeholder="0" 
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  className="h-6 text-xs text-center p-0 border-0 bg-transparent"
                />
                <div className="text-[10px] text-muted-foreground">Steps (k)</div>
              </Card>
              <Card className="p-3 text-center">
                <Apple className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <Input 
                  type="number" 
                  placeholder="0" 
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="h-6 text-xs text-center p-0 border-0 bg-transparent"
                />
                <div className="text-[10px] text-muted-foreground">Calories</div>
              </Card>
            </div>

            {/* BMI Calculator */}
            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">BMI Calculator</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Weight (kg)</Label>
                  <Input 
                    type="number" 
                    placeholder="70" 
                    value={weight} 
                    onChange={(e) => setWeight(e.target.value)}
                    min="1"
                    max="500"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Height (cm)</Label>
                  <Input 
                    type="number" 
                    placeholder="175" 
                    value={height} 
                    onChange={(e) => setHeight(e.target.value)}
                    min="50"
                    max="300"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Age</Label>
                  <Input 
                    type="number" 
                    placeholder="25" 
                    value={age} 
                    onChange={(e) => setAge(e.target.value)}
                    min="1"
                    max="150"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={(v) => setGender(v as 'male' | 'female')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Activity Level</Label>
                <Select value={activityLevel} onValueChange={setActivityLevel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_LEVELS.map(level => (
                      <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={calculateBmi} className="w-full">
                <Calculator className="h-4 w-4 mr-2" />
                Calculate
              </Button>
              
              {bmiResult && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="p-3 text-center">
                      <div className={cn("text-2xl font-bold", getBmiColor(bmiResult.category))}>
                        {bmiResult.bmi}
                      </div>
                      <div className="text-xs text-muted-foreground">BMI</div>
                      <div className={cn("text-xs font-medium", getBmiColor(bmiResult.category))}>
                        {bmiResult.category}
                      </div>
                    </Card>
                    <Card className="p-3 text-center">
                      <div className="text-2xl font-bold text-primary">{bmiResult.bmr}</div>
                      <div className="text-xs text-muted-foreground">BMR</div>
                      <div className="text-xs text-muted-foreground">cal/day</div>
                    </Card>
                    <Card className="p-3 text-center">
                      <div className="text-2xl font-bold text-accent">{bmiResult.tdee}</div>
                      <div className="text-xs text-muted-foreground">TDEE</div>
                      <div className="text-xs text-muted-foreground">cal/day</div>
                    </Card>
                  </div>

                  {idealWeight && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Scale className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Ideal Weight Range</span>
                      </div>
                      <div className="text-lg font-bold text-primary">{idealWeight.min} - {idealWeight.max} kg</div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <Textarea 
                      placeholder="Any notes about your health today..." 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={500}
                    />
                  </div>
                  
                  <Button onClick={saveBmiRecord} variant="secondary" className="w-full">
                    Save to History
                  </Button>
                </div>
              )}
            </Card>

            {/* Weight Trend Chart */}
            {weightTrendData.length > 1 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Weight Trend</h3>
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weightTrendData}>
                      <defs>
                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(270, 60%, 45%)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(270, 60%, 45%)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={['dataMin - 2', 'dataMax + 2']} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        formatter={(value: number) => [`${value} kg`, 'Weight']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="weight" 
                        stroke="hsl(270, 60%, 45%)" 
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorWeight)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
            
            {/* Health History */}
            {healthHistory.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Heart className="h-5 w-5 text-destructive" />
                  <h3 className="font-semibold">Health History</h3>
                </div>
                <div className="space-y-3">
                  {healthHistory.slice(0, 5).map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div>
                        <div className="font-medium">{new Date(record.date).toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {record.weight_kg}kg • {record.height_cm}cm
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn("font-bold", 
                          record.bmi < 18.5 || record.bmi >= 25 ? 'text-warning' : 'text-success'
                        )}>
                          BMI: {record.bmi}
                        </div>
                        <div className="text-xs text-muted-foreground">BMR: {record.bmr}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
};

export default Goals;
