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
import { 
  Target, Plus, Trash2, TrendingUp, Rocket, Edit2, Check, X, Calculator, 
  Activity, Heart, Scale, Droplets, Moon, Dumbbell, Apple, Brain, 
  Smile, Frown, Meh, Zap, Wind, Footprints, Timer, Flame, 
  HeartPulse, Gauge, Ruler, Coffee, Save
} from "lucide-react";
import { toast } from "sonner";
import type { ProductivityGoal, Mission, DailyReport } from "@/types";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, RadialBarChart, RadialBar } from 'recharts';

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

const MOOD_OPTIONS = [
  { value: 'excellent', label: 'Excellent', icon: Smile, color: 'text-success' },
  { value: 'good', label: 'Good', icon: Smile, color: 'text-primary' },
  { value: 'okay', label: 'Okay', icon: Meh, color: 'text-warning' },
  { value: 'bad', label: 'Bad', icon: Frown, color: 'text-destructive' },
];

const EXERCISE_TYPES = [
  { value: 'walking', label: 'Walking' },
  { value: 'running', label: 'Running' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'strength', label: 'Strength Training' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'hiit', label: 'HIIT' },
  { value: 'sports', label: 'Sports' },
  { value: 'other', label: 'Other' },
];

const SLEEP_QUALITY = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
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

  // Enhanced health tracking state
  const [waterIntake, setWaterIntake] = useState(0);
  const [sleepHours, setSleepHours] = useState('');
  const [sleepQuality, setSleepQuality] = useState('');
  const [steps, setSteps] = useState('');
  const [caloriesConsumed, setCaloriesConsumed] = useState('');
  const [caloriesBurned, setCaloriesBurned] = useState('');
  const [mood, setMood] = useState('');
  const [moodNotes, setMoodNotes] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [bloodPressureSystolic, setBloodPressureSystolic] = useState('');
  const [bloodPressureDiastolic, setBloodPressureDiastolic] = useState('');
  const [bodyFatPercent, setBodyFatPercent] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [exerciseMinutes, setExerciseMinutes] = useState('');
  const [exerciseType, setExerciseType] = useState('');
  const [stressLevel, setStressLevel] = useState(5);
  const [energyLevel, setEnergyLevel] = useState(5);
  const [healthTab, setHealthTab] = useState('daily');
  
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
        if (latest.water_glasses) setWaterIntake(latest.water_glasses);
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

  // Health metrics summary
  const healthMetricsSummary = useMemo(() => {
    if (healthHistory.length === 0) return null;
    
    const last7 = healthHistory.slice(0, 7);
    const avgSleep = last7.filter(r => r.sleep_hours).reduce((sum, r) => sum + (r.sleep_hours || 0), 0) / (last7.filter(r => r.sleep_hours).length || 1);
    const avgSteps = last7.filter(r => r.steps).reduce((sum, r) => sum + (r.steps || 0), 0) / (last7.filter(r => r.steps).length || 1);
    const avgWater = last7.filter(r => r.water_glasses).reduce((sum, r) => sum + (r.water_glasses || 0), 0) / (last7.filter(r => r.water_glasses).length || 1);
    const avgExercise = last7.filter(r => r.exercise_minutes).reduce((sum, r) => sum + (r.exercise_minutes || 0), 0) / (last7.filter(r => r.exercise_minutes).length || 1);
    
    return { avgSleep, avgSteps, avgWater, avgExercise };
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
  
  // Save comprehensive health record
  const saveHealthRecord = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please login to save');
      return;
    }

    // Validate required fields
    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);
    const ageNum = parseInt(age);
    
    if (!weightNum || weightNum <= 0 || weightNum >= 500) {
      toast.error('Please enter a valid weight (1-499 kg)');
      return;
    }
    if (!heightNum || heightNum <= 0 || heightNum >= 300) {
      toast.error('Please enter a valid height (1-299 cm)');
      return;
    }
    if (!ageNum || ageNum <= 0 || ageNum >= 150) {
      toast.error('Please enter a valid age (1-149)');
      return;
    }

    const heartRateNum = parseInt(heartRate) || null;
    if (heartRateNum !== null && (heartRateNum < 30 || heartRateNum > 250)) {
      toast.error('Heart rate must be between 30-250 bpm');
      return;
    }

    const bpSys = parseInt(bloodPressureSystolic) || null;
    const bpDia = parseInt(bloodPressureDiastolic) || null;
    if (bpSys !== null && (bpSys < 50 || bpSys > 300)) {
      toast.error('Systolic BP must be between 50-300');
      return;
    }
    if (bpDia !== null && (bpDia < 30 || bpDia > 200)) {
      toast.error('Diastolic BP must be between 30-200');
      return;
    }

    const healthData = {
      user_id: user.id,
      weight_kg: weightNum,
      height_cm: heightNum,
      age: ageNum,
      gender: gender || 'male',
      activity_level: activityLevel,
      bmi: bmiResult?.bmi || null,
      bmr: bmiResult?.bmr || null,
      notes: notes || null,
      sleep_hours: parseFloat(sleepHours) || null,
      sleep_quality: sleepQuality || null,
      steps: parseInt(steps) || null,
      water_glasses: waterIntake,
      calories_consumed: parseInt(caloriesConsumed) || null,
      calories_burned: parseInt(caloriesBurned) || null,
      mood: mood || null,
      mood_notes: moodNotes || null,
      heart_rate: heartRateNum,
      blood_pressure_systolic: bpSys,
      blood_pressure_diastolic: bpDia,
      body_fat_percent: parseFloat(bodyFatPercent) || null,
      waist_cm: parseFloat(waistCm) || null,
      exercise_minutes: parseInt(exerciseMinutes) || null,
      exercise_type: exerciseType || null,
      stress_level: stressLevel,
      energy_level: energyLevel
    };

    const { error } = await supabase.from('health_tracking').insert(healthData);
    
    if (error) {
      toast.error('Failed to save record. Please check your inputs.');
    } else {
      toast.success('Health record saved!');
      loadData();
    }
  }, [weight, height, age, gender, activityLevel, bmiResult, notes, sleepHours, sleepQuality, steps, waterIntake, caloriesConsumed, caloriesBurned, mood, moodNotes, heartRate, bloodPressureSystolic, bloodPressureDiastolic, bodyFatPercent, waistCm, exerciseMinutes, exerciseType, stressLevel, energyLevel, loadData]);
  
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

  const removeWater = useCallback(() => {
    setWaterIntake(prev => Math.max(prev - 1, 0));
  }, []);

  // Health score calculation
  const healthScore = useMemo(() => {
    let score = 0;
    let factors = 0;
    
    if (waterIntake >= 8) { score += 20; factors++; }
    else if (waterIntake >= 4) { score += 10; factors++; }
    
    const sleep = parseFloat(sleepHours);
    if (sleep >= 7 && sleep <= 9) { score += 25; factors++; }
    else if (sleep >= 6) { score += 15; factors++; }
    
    const stepsVal = parseInt(steps);
    if (stepsVal >= 10000) { score += 25; factors++; }
    else if (stepsVal >= 5000) { score += 15; factors++; }
    
    const exercise = parseInt(exerciseMinutes);
    if (exercise >= 30) { score += 20; factors++; }
    else if (exercise >= 15) { score += 10; factors++; }
    
    if (mood === 'excellent' || mood === 'good') { score += 10; factors++; }
    
    return factors > 0 ? Math.min(100, Math.round((score / factors) * (factors / 5) * 5)) : 0;
  }, [waterIntake, sleepHours, steps, exerciseMinutes, mood]);
  
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
              <Card className="p-4 space-y-4 border-primary/20">
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
                  <Card key={goal.id} className={cn("p-4 transition-all", isAchieved && "border-success/50 bg-success/5")}>
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
              <Card className="p-4 space-y-4 border-primary/20">
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
                      <Card key={mission.id} className="p-4 hover:shadow-md transition-shadow">
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
          
          {/* Health Tab - Comprehensive */}
          <TabsContent value="health" className="space-y-4 mt-4">
            {/* Health Score Card */}
            <Card className="p-4 bg-gradient-to-br from-primary/5 to-accent/5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Heart className="h-5 w-5 text-destructive" />
                    Today's Health Score
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Based on your logged data</p>
                </div>
                <div className={cn(
                  "h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold",
                  healthScore >= 70 ? "bg-success/20 text-success" :
                  healthScore >= 40 ? "bg-warning/20 text-warning" :
                  "bg-muted text-muted-foreground"
                )}>
                  {healthScore}
                </div>
              </div>
            </Card>

            {/* Sub-tabs for health sections */}
            <Tabs value={healthTab} onValueChange={setHealthTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 h-auto">
                <TabsTrigger value="daily" className="text-[10px] py-1.5">Daily</TabsTrigger>
                <TabsTrigger value="body" className="text-[10px] py-1.5">Body</TabsTrigger>
                <TabsTrigger value="vitals" className="text-[10px] py-1.5">Vitals</TabsTrigger>
                <TabsTrigger value="history" className="text-[10px] py-1.5">History</TabsTrigger>
              </TabsList>

              {/* Daily Tracking Tab */}
              <TabsContent value="daily" className="space-y-4 mt-4">
                {/* Quick Health Actions */}
                <div className="grid grid-cols-4 gap-2">
                  <Card className="p-3 text-center cursor-pointer hover:bg-accent/10 transition-colors active:scale-95" onClick={addWater}>
                    <Droplets className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                    <div className="text-sm font-bold">{waterIntake}/8</div>
                    <div className="text-[10px] text-muted-foreground">Water</div>
                    <div className="flex gap-1 mt-1 justify-center">
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); removeWater(); }}>-</Button>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); addWater(); }}>+</Button>
                    </div>
                  </Card>
                  <Card className="p-3 text-center">
                    <Moon className="h-5 w-5 mx-auto mb-1 text-indigo-500" />
                    <Input 
                      type="number" 
                      placeholder="0" 
                      value={sleepHours}
                      onChange={(e) => setSleepHours(e.target.value)}
                      className="h-6 text-sm text-center p-0 border-0 bg-transparent font-bold"
                      step="0.5"
                      min="0"
                      max="24"
                    />
                    <div className="text-[10px] text-muted-foreground">Sleep hrs</div>
                  </Card>
                  <Card className="p-3 text-center">
                    <Footprints className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                    <Input 
                      type="number" 
                      placeholder="0" 
                      value={steps}
                      onChange={(e) => setSteps(e.target.value)}
                      className="h-6 text-sm text-center p-0 border-0 bg-transparent font-bold"
                    />
                    <div className="text-[10px] text-muted-foreground">Steps</div>
                  </Card>
                  <Card className="p-3 text-center">
                    <Timer className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <Input 
                      type="number" 
                      placeholder="0" 
                      value={exerciseMinutes}
                      onChange={(e) => setExerciseMinutes(e.target.value)}
                      className="h-6 text-sm text-center p-0 border-0 bg-transparent font-bold"
                    />
                    <div className="text-[10px] text-muted-foreground">Exercise</div>
                  </Card>
                </div>

                {/* Mood Tracker */}
                <Card className="p-4">
                  <Label className="flex items-center gap-2 mb-3">
                    <Brain className="h-4 w-4 text-primary" />
                    How are you feeling?
                  </Label>
                  <div className="grid grid-cols-4 gap-2">
                    {MOOD_OPTIONS.map(option => (
                      <Button
                        key={option.value}
                        variant={mood === option.value ? "default" : "outline"}
                        size="sm"
                        className={cn("flex-col h-auto py-2", mood === option.value && option.color)}
                        onClick={() => setMood(option.value)}
                      >
                        <option.icon className="h-5 w-5 mb-1" />
                        <span className="text-[10px]">{option.label}</span>
                      </Button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Notes about your mood (optional)..."
                    value={moodNotes}
                    onChange={(e) => setMoodNotes(e.target.value)}
                    className="mt-3 text-sm"
                    maxLength={300}
                  />
                </Card>

                {/* Calories */}
                <Card className="p-4">
                  <Label className="flex items-center gap-2 mb-3">
                    <Flame className="h-4 w-4 text-orange-500" />
                    Calories
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Consumed</Label>
                      <div className="flex items-center gap-2">
                        <Apple className="h-4 w-4 text-green-500" />
                        <Input 
                          type="number" 
                          placeholder="0" 
                          value={caloriesConsumed}
                          onChange={(e) => setCaloriesConsumed(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Burned</Label>
                      <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-orange-500" />
                        <Input 
                          type="number" 
                          placeholder="0" 
                          value={caloriesBurned}
                          onChange={(e) => setCaloriesBurned(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Energy & Stress Levels */}
                <Card className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">
                      <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-500" /> Energy Level</span>
                      <span className="font-bold">{energyLevel}/10</span>
                    </Label>
                    <Slider value={[energyLevel]} min={1} max={10} step={1} onValueChange={([v]) => setEnergyLevel(v)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">
                      <span className="flex items-center gap-2"><Wind className="h-4 w-4 text-blue-500" /> Stress Level</span>
                      <span className="font-bold">{stressLevel}/10</span>
                    </Label>
                    <Slider value={[stressLevel]} min={1} max={10} step={1} onValueChange={([v]) => setStressLevel(v)} />
                  </div>
                </Card>

                {/* Exercise Type & Sleep Quality */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-4">
                    <Label className="text-xs mb-2 block">Exercise Type</Label>
                    <Select value={exerciseType} onValueChange={setExerciseType}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {EXERCISE_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Card>
                  <Card className="p-4">
                    <Label className="text-xs mb-2 block">Sleep Quality</Label>
                    <Select value={sleepQuality} onValueChange={setSleepQuality}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {SLEEP_QUALITY.map(q => (
                          <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Card>
                </div>
              </TabsContent>

              {/* Body Measurements Tab */}
              <TabsContent value="body" className="space-y-4 mt-4">
                {/* BMI Calculator */}
                <Card className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Body Metrics</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Weight (kg)</Label>
                      <Input type="number" placeholder="70" value={weight} onChange={(e) => setWeight(e.target.value)} min="1" max="500" />
                    </div>
                    <div className="space-y-2">
                      <Label>Height (cm)</Label>
                      <Input type="number" placeholder="175" value={height} onChange={(e) => setHeight(e.target.value)} min="50" max="300" />
                    </div>
                    <div className="space-y-2">
                      <Label>Age</Label>
                      <Input type="number" placeholder="25" value={age} onChange={(e) => setAge(e.target.value)} min="1" max="150" />
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
                    Calculate BMI/BMR/TDEE
                  </Button>
                  
                  {bmiResult && (
                    <div className="space-y-4 pt-4 border-t">
                      <div className="grid grid-cols-3 gap-3">
                        <Card className="p-3 text-center bg-gradient-to-br from-primary/5 to-transparent">
                          <div className={cn("text-2xl font-bold", getBmiColor(bmiResult.category))}>
                            {bmiResult.bmi}
                          </div>
                          <div className="text-xs text-muted-foreground">BMI</div>
                          <div className={cn("text-xs font-medium", getBmiColor(bmiResult.category))}>
                            {bmiResult.category}
                          </div>
                        </Card>
                        <Card className="p-3 text-center bg-gradient-to-br from-accent/5 to-transparent">
                          <div className="text-2xl font-bold text-primary">{bmiResult.bmr}</div>
                          <div className="text-xs text-muted-foreground">BMR</div>
                          <div className="text-xs text-muted-foreground">cal/day</div>
                        </Card>
                        <Card className="p-3 text-center bg-gradient-to-br from-success/5 to-transparent">
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
                    </div>
                  )}
                </Card>

                {/* Additional Body Measurements */}
                <Card className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Ruler className="h-5 w-5 text-info" />
                    <h3 className="font-semibold">Additional Measurements</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Body Fat %</Label>
                      <Input 
                        type="number" 
                        placeholder="e.g., 15" 
                        value={bodyFatPercent}
                        onChange={(e) => setBodyFatPercent(e.target.value)}
                        step="0.1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Waist (cm)</Label>
                      <Input 
                        type="number" 
                        placeholder="e.g., 80" 
                        value={waistCm}
                        onChange={(e) => setWaistCm(e.target.value)}
                      />
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Vitals Tab */}
              <TabsContent value="vitals" className="space-y-4 mt-4">
                <Card className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="h-5 w-5 text-destructive" />
                    <h3 className="font-semibold">Vital Signs</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-destructive" />
                        Heart Rate (BPM)
                      </Label>
                      <Input 
                        type="number" 
                        placeholder="e.g., 72" 
                        value={heartRate}
                        onChange={(e) => setHeartRate(e.target.value)}
                        min="40"
                        max="220"
                      />
                      {heartRate && (
                        <p className="text-xs text-muted-foreground">
                          {parseInt(heartRate) < 60 ? 'Low' : parseInt(heartRate) > 100 ? 'Elevated' : 'Normal'} resting heart rate
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-primary" />
                        Blood Pressure (mmHg)
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Input 
                            type="number" 
                            placeholder="Systolic (120)" 
                            value={bloodPressureSystolic}
                            onChange={(e) => setBloodPressureSystolic(e.target.value)}
                          />
                          <span className="text-xs text-muted-foreground">Systolic (top)</span>
                        </div>
                        <div>
                          <Input 
                            type="number" 
                            placeholder="Diastolic (80)" 
                            value={bloodPressureDiastolic}
                            onChange={(e) => setBloodPressureDiastolic(e.target.value)}
                          />
                          <span className="text-xs text-muted-foreground">Diastolic (bottom)</span>
                        </div>
                      </div>
                      {bloodPressureSystolic && bloodPressureDiastolic && (
                        <p className="text-xs text-muted-foreground">
                          {parseInt(bloodPressureSystolic) < 120 && parseInt(bloodPressureDiastolic) < 80 ? 'Normal' :
                           parseInt(bloodPressureSystolic) < 130 && parseInt(bloodPressureDiastolic) < 80 ? 'Elevated' :
                           'High'} blood pressure range
                        </p>
                      )}
                    </div>
                  </div>
                </Card>

                <Card className="p-4 space-y-3">
                  <Label>Additional Notes</Label>
                  <Textarea 
                    placeholder="Any health notes, symptoms, medications..." 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={500}
                  />
                </Card>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="space-y-4 mt-4">
                {/* Weekly Summary */}
                {healthMetricsSummary && (
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      7-Day Averages
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-muted/30 rounded-lg text-center">
                        <Moon className="h-5 w-5 mx-auto mb-1 text-indigo-500" />
                        <div className="text-lg font-bold">{healthMetricsSummary.avgSleep.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">Avg Sleep (hrs)</div>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg text-center">
                        <Footprints className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                        <div className="text-lg font-bold">{Math.round(healthMetricsSummary.avgSteps).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Avg Steps</div>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg text-center">
                        <Droplets className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                        <div className="text-lg font-bold">{healthMetricsSummary.avgWater.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">Avg Water</div>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg text-center">
                        <Timer className="h-5 w-5 mx-auto mb-1 text-green-500" />
                        <div className="text-lg font-bold">{Math.round(healthMetricsSummary.avgExercise)}</div>
                        <div className="text-xs text-muted-foreground">Avg Exercise (min)</div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Weight Trend Chart */}
                {weightTrendData.length > 1 && (
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Scale className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Weight Trend</h3>
                    </div>
                    <div className="h-44">
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
                
                {/* Health History List */}
                {healthHistory.length > 0 && (
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Heart className="h-5 w-5 text-destructive" />
                      <h3 className="font-semibold">Recent Records</h3>
                    </div>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {healthHistory.slice(0, 10).map((record) => (
                        <div key={record.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div>
                            <div className="font-medium">{new Date(record.date).toLocaleDateString()}</div>
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                              {record.weight_kg && <span>{record.weight_kg}kg</span>}
                              {record.bmi && <span>BMI {record.bmi}</span>}
                              {record.sleep_hours && <span>{record.sleep_hours}h sleep</span>}
                              {record.steps && <span>{record.steps.toLocaleString()} steps</span>}
                              {record.mood && <span className="capitalize">{record.mood}</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={cn("text-sm font-medium", 
                              record.bmi < 18.5 ? 'text-warning' :
                              record.bmi < 25 ? 'text-success' :
                              record.bmi < 30 ? 'text-warning' :
                              'text-destructive'
                            )}>
                              {record.bmi ? `${record.bmi}` : '-'}
                            </div>
                            <div className="text-xs text-muted-foreground">BMI</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {healthHistory.length === 0 && (
                  <Card className="p-6 text-center">
                    <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground mb-2">No health records yet</p>
                    <p className="text-xs text-muted-foreground">Start tracking to see your history</p>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            {/* Save Button - Fixed at bottom */}
            <Card className="p-4 sticky bottom-4 bg-card/95 backdrop-blur-sm border-primary/20">
              <Button onClick={saveHealthRecord} className="w-full" size="lg">
                <Save className="h-4 w-4 mr-2" />
                Save Today's Health Data
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
};

export default Goals;