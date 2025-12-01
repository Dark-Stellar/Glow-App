import { useEffect, useState } from "react";
import { MobileLayout } from "@/components/MobileLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { getAllDailyReports } from "@/lib/storage";
import { Target, Plus, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import type { ProductivityGoal } from "@/types";

const Goals = () => {
  const [goals, setGoals] = useState<ProductivityGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [goalType, setGoalType] = useState<'weekly' | 'monthly'>('weekly');
  const [targetPercentage, setTargetPercentage] = useState(75);
  
  useEffect(() => {
    loadGoals();
  }, []);
  
  async function loadGoals() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data, error } = await supabase
      .from('productivity_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading goals:', error);
      toast.error('Failed to load goals');
    } else {
      setGoals(data.map(g => ({
        id: g.id,
        goalType: g.goal_type as 'weekly' | 'monthly',
        targetPercentage: g.target_percentage,
        startDate: g.start_date,
        endDate: g.end_date,
        createdAt: g.created_at
      })));
    }
    
    setLoading(false);
  }
  
  async function createGoal() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    
    let endDate: string;
    if (goalType === 'weekly') {
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      endDate = end.toISOString().split('T')[0];
    } else {
      const end = new Date(today);
      end.setMonth(end.getMonth() + 1);
      endDate = end.toISOString().split('T')[0];
    }
    
    const { error } = await supabase
      .from('productivity_goals')
      .insert({
        user_id: user.id,
        goal_type: goalType,
        target_percentage: targetPercentage,
        start_date: startDate,
        end_date: endDate
      });
    
    if (error) {
      console.error('Error creating goal:', error);
      toast.error('Failed to create goal');
    } else {
      toast.success('Goal created!');
      setShowForm(false);
      loadGoals();
    }
  }
  
  async function deleteGoal(id: string) {
    const { error } = await supabase
      .from('productivity_goals')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting goal:', error);
      toast.error('Failed to delete goal');
    } else {
      toast.success('Goal deleted');
      loadGoals();
    }
  }
  
  async function calculateProgress(goal: ProductivityGoal) {
    const reports = await getAllDailyReports();
    const relevantReports = reports.filter(r => 
      r.date >= goal.startDate && r.date <= goal.endDate
    );
    
    if (relevantReports.length === 0) return 0;
    
    const avg = relevantReports.reduce((sum, r) => sum + r.productivityPercent, 0) / relevantReports.length;
    return avg;
  }
  
  const [progressData, setProgressData] = useState<{ [key: string]: number }>({});
  
  useEffect(() => {
    async function loadProgress() {
      const data: { [key: string]: number } = {};
      for (const goal of goals) {
        data[goal.id] = await calculateProgress(goal);
      }
      setProgressData(data);
    }
    if (goals.length > 0) {
      loadProgress();
    }
  }, [goals]);
  
  if (loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </MobileLayout>
    );
  }
  
  return (
    <MobileLayout>
      <div className="container max-w-2xl mx-auto p-4 space-y-4">
        <div className="pt-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Goals</h1>
            </div>
            <p className="text-sm text-muted-foreground">Set and track targets</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Goal
          </Button>
        </div>
        
        {showForm && (
          <Card className="p-4 space-y-4">
            <h3 className="font-semibold">Create New Goal</h3>
            
            <div className="space-y-2">
              <Label>Goal Type</Label>
              <Select value={goalType} onValueChange={(v) => setGoalType(v as 'weekly' | 'monthly')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Target Productivity (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={targetPercentage}
                onChange={(e) => setTargetPercentage(Math.max(0, Math.min(100, Number(e.target.value))))}
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={createGoal} className="flex-1">
                Create Goal
              </Button>
              <Button onClick={() => setShowForm(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </Card>
        )}
        
        <div className="space-y-3">
          {goals.length === 0 && !showForm && (
            <Card className="p-6 text-center">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground mb-4">No goals yet</p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Goal
              </Button>
            </Card>
          )}
          
          {goals.map((goal) => {
            const progress = progressData[goal.id] || 0;
            const isAchieved = progress >= goal.targetPercentage;
            const daysLeft = Math.ceil((new Date(goal.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            const isActive = daysLeft >= 0;
            
            return (
              <Card key={goal.id} className={`p-4 ${isAchieved ? 'border-success' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      isAchieved ? 'bg-success/10' : 'bg-primary/10'
                    }`}>
                      {isAchieved ? (
                        <TrendingUp className="h-5 w-5 text-success" />
                      ) : (
                        <Target className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold capitalize">{goal.goalType} Goal</h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(goal.startDate).toLocaleDateString()} - {new Date(goal.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteGoal(goal.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Target: {goal.targetPercentage}%</span>
                    <span className={`font-bold ${isAchieved ? 'text-success' : ''}`}>
                      Current: {Math.round(progress)}%
                    </span>
                  </div>
                  <Progress value={(progress / goal.targetPercentage) * 100} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {isActive ? (
                        daysLeft === 0 ? 'Ends today' :
                        daysLeft === 1 ? '1 day left' :
                        `${daysLeft} days left`
                      ) : 'Expired'}
                    </span>
                    {isAchieved && <span className="text-success font-semibold">✓ Achieved!</span>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </MobileLayout>
  );
};

export default Goals;
