import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Scale, Activity, Sparkles, RefreshCw, TrendingUp, TrendingDown, History, X, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HealthRecord {
  id: string;
  date: string;
  weight_kg: number;
  height_cm: number;
  age: number;
  gender: string;
  activity_level: string;
  bmi: number;
  bmr: number;
  notes: string | null;
  ai_feedback: string | null;
}

const getBMICategory = (bmi: number) => {
  if (bmi < 18.5) return { label: "Underweight", color: "text-warning", bg: "bg-warning/10" };
  if (bmi < 25) return { label: "Normal", color: "text-success", bg: "bg-success/10" };
  if (bmi < 30) return { label: "Overweight", color: "text-warning", bg: "bg-warning/10" };
  return { label: "Obese", color: "text-destructive", bg: "bg-destructive/10" };
};

const getActivityMultiplier = (level: string) => {
  switch (level) {
    case 'sedentary': return 1.2;
    case 'light': return 1.375;
    case 'moderate': return 1.55;
    case 'active': return 1.725;
    case 'very_active': return 1.9;
    default: return 1.2;
  }
};

export function HealthTracker() {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<string>("male");
  const [activityLevel, setActivityLevel] = useState<string>("sedentary");
  const [notes, setNotes] = useState("");
  const [aiFeedback, setAiFeedback] = useState("");

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('health_tracking')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error loading health records:', error);
    } else if (data) {
      setRecords(data as HealthRecord[]);
      // Pre-fill form with latest record
      if (data.length > 0) {
        const latest = data[0] as HealthRecord;
        setHeight(latest.height_cm.toString());
        setAge(latest.age.toString());
        setGender(latest.gender);
        setActivityLevel(latest.activity_level);
      }
    }
    setLoading(false);
  }, []);

  const calculateBMI = (w: number, h: number) => w / ((h / 100) ** 2);
  const calculateBMR = (w: number, h: number, a: number, g: string) => {
    if (g === 'male') return (10 * w) + (6.25 * h) - (5 * a) + 5;
    return (10 * w) + (6.25 * h) - (5 * a) - 161;
  };

  const handleSave = async () => {
    if (!weight || !height || !age) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in");
      setSaving(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase
      .from('health_tracking')
      .upsert({
        user_id: user.id,
        date: today,
        weight_kg: parseFloat(weight),
        height_cm: parseFloat(height),
        age: parseInt(age),
        gender,
        activity_level: activityLevel,
        notes: notes || null,
        ai_feedback: aiFeedback || null,
      }, {
        onConflict: 'user_id,date'
      });

    if (error) {
      console.error('Error saving:', error);
      toast.error("Failed to save health data");
    } else {
      toast.success("Health data saved!");
      loadRecords();
      setShowForm(false);
    }
    setSaving(false);
  };

  const getAIFeedback = async () => {
    if (!weight || !height || !age) {
      toast.error("Please fill in weight, height, and age first");
      return;
    }

    setLoadingAI(true);
    try {
      const w = parseFloat(weight);
      const h = parseFloat(height);
      const a = parseInt(age);
      const bmi = calculateBMI(w, h);
      const bmr = calculateBMR(w, h, a, gender);
      const tdee = bmr * getActivityMultiplier(activityLevel);

      const { data, error } = await supabase.functions.invoke('ai-insights', {
        body: {
          type: 'health-feedback',
          healthData: {
            weight: w,
            height: h,
            age: a,
            gender,
            activityLevel,
            bmi: Math.round(bmi * 10) / 10,
            bmr: Math.round(bmr),
            tdee: Math.round(tdee),
          },
          history: records.slice(0, 5).map(r => ({
            date: r.date,
            weight: r.weight_kg,
            bmi: r.bmi
          }))
        }
      });

      if (error) throw error;
      if (data?.feedback) {
        setAiFeedback(data.feedback);
        toast.success("AI feedback generated!");
      }
    } catch (error: any) {
      console.error('AI feedback error:', error);
      if (error?.message?.includes('429')) {
        toast.error("Rate limited. Please try again later.");
      } else if (error?.message?.includes('402')) {
        toast.error("Please add credits to continue using AI features.");
      } else {
        // Generate basic feedback
        const w = parseFloat(weight);
        const h = parseFloat(height);
        const bmi = calculateBMI(w, h);
        const category = getBMICategory(bmi);
        setAiFeedback(`Your BMI is ${bmi.toFixed(1)} (${category.label}). ${
          bmi < 18.5 ? "Consider increasing caloric intake with nutritious foods." :
          bmi < 25 ? "Great job maintaining a healthy weight! Continue your balanced lifestyle." :
          bmi < 30 ? "Small changes like daily walks can help improve your health." :
          "Consult a healthcare provider for personalized advice."
        }`);
      }
    } finally {
      setLoadingAI(false);
    }
  };

  const latestRecord = records[0];
  const previousRecord = records[1];
  
  const weightTrend = latestRecord && previousRecord 
    ? latestRecord.weight_kg - previousRecord.weight_kg 
    : null;

  if (loading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse text-muted-foreground text-center py-4">Loading health data...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Current Stats */}
      {latestRecord && !showForm && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Health Stats</h3>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              Update
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">Weight</div>
              <div className="text-xl font-bold flex items-center gap-1">
                {latestRecord.weight_kg} kg
                {weightTrend !== null && (
                  <span className={`text-xs flex items-center ${weightTrend > 0 ? 'text-destructive' : weightTrend < 0 ? 'text-success' : 'text-muted-foreground'}`}>
                    {weightTrend > 0 ? <TrendingUp className="h-3 w-3" /> : weightTrend < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                    {weightTrend !== 0 && `${weightTrend > 0 ? '+' : ''}${weightTrend.toFixed(1)}`}
                  </span>
                )}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">Height</div>
              <div className="text-xl font-bold">{latestRecord.height_cm} cm</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className={`p-3 rounded-lg ${getBMICategory(latestRecord.bmi).bg}`}>
              <div className="text-xs text-muted-foreground mb-1">BMI</div>
              <div className={`text-xl font-bold ${getBMICategory(latestRecord.bmi).color}`}>
                {latestRecord.bmi.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">{getBMICategory(latestRecord.bmi).label}</div>
            </div>
            <div className="p-3 rounded-lg bg-primary/10">
              <div className="text-xs text-muted-foreground mb-1">BMR</div>
              <div className="text-xl font-bold text-primary">{Math.round(latestRecord.bmr)}</div>
              <div className="text-xs text-muted-foreground">kcal/day</div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-accent/10 mb-3">
            <div className="text-xs text-muted-foreground mb-1">Daily Calorie Needs (TDEE)</div>
            <div className="text-xl font-bold text-accent">
              {Math.round(latestRecord.bmr * getActivityMultiplier(latestRecord.activity_level))} kcal
            </div>
            <div className="text-xs text-muted-foreground capitalize">{latestRecord.activity_level.replace('_', ' ')} activity</div>
          </div>

          {latestRecord.ai_feedback && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">AI Guidance</span>
              </div>
              <p className="text-sm">{latestRecord.ai_feedback}</p>
            </div>
          )}

          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mt-3"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="h-4 w-4 mr-2" />
            {showHistory ? 'Hide' : 'Show'} History
            {showHistory ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
          </Button>
        </Card>
      )}

      {/* History */}
      {showHistory && records.length > 1 && (
        <Card className="p-4">
          <h4 className="font-semibold mb-3 text-sm">Recent Records</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {records.slice(0, 10).map((record) => (
              <div key={record.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30">
                <span className="text-muted-foreground">{new Date(record.date).toLocaleDateString()}</span>
                <div className="flex items-center gap-4">
                  <span>{record.weight_kg} kg</span>
                  <span className={getBMICategory(record.bmi).color}>{record.bmi.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Input Form */}
      {(showForm || !latestRecord) && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Track Health</h3>
            </div>
            {latestRecord && (
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-2">
              <Label>Weight (kg) *</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="70"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Height (cm) *</Label>
              <Input
                type="number"
                placeholder="175"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-2">
              <Label>Age *</Label>
              <Input
                type="number"
                placeholder="25"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Gender *</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            <Label>Activity Level</Label>
            <Select value={activityLevel} onValueChange={setActivityLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Sedentary (little/no exercise)</SelectItem>
                <SelectItem value="light">Light (1-3 days/week)</SelectItem>
                <SelectItem value="moderate">Moderate (3-5 days/week)</SelectItem>
                <SelectItem value="active">Active (6-7 days/week)</SelectItem>
                <SelectItem value="very_active">Very Active (physical job)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Live BMI/BMR Preview */}
          {weight && height && age && (
            <div className="grid grid-cols-2 gap-3 mb-3 p-3 rounded-lg bg-muted/30">
              <div>
                <div className="text-xs text-muted-foreground">Calculated BMI</div>
                <div className={`font-bold ${getBMICategory(calculateBMI(parseFloat(weight), parseFloat(height))).color}`}>
                  {calculateBMI(parseFloat(weight), parseFloat(height)).toFixed(1)} ({getBMICategory(calculateBMI(parseFloat(weight), parseFloat(height))).label})
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Calculated BMR</div>
                <div className="font-bold text-primary">
                  {Math.round(calculateBMR(parseFloat(weight), parseFloat(height), parseInt(age), gender))} kcal
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 mb-3">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Any notes about your health today..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <Button
            variant="outline"
            className="w-full mb-3"
            onClick={getAIFeedback}
            disabled={loadingAI || !weight || !height || !age}
          >
            {loadingAI ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Get AI Guidance
          </Button>

          {aiFeedback && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 mb-3">
              <p className="text-sm">{aiFeedback}</p>
            </div>
          )}

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Health Data
          </Button>
        </Card>
      )}
    </div>
  );
}