import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Save, AlertCircle, Trash2, GripVertical, Copy, Sparkles } from "lucide-react";
import { MobileLayout } from "@/components/MobileLayout";
import { TaskRow } from "@/components/TaskRow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getDraftTasks, saveDraftTasks, normalizeWeights } from "@/lib/storage";
import { getTodayString } from "@/lib/dates";
import type { Task } from "@/types";
import { toast } from "sonner";
import { saveDefaultTemplate } from "@/lib/defaultTemplate";
import { Badge } from "@/components/ui/badge";

const QUICK_TEMPLATES = [
  { name: "Work Day", tasks: [{ title: "Deep Work", weight: 40 }, { title: "Meetings", weight: 20 }, { title: "Admin Tasks", weight: 20 }, { title: "Learning", weight: 20 }] },
  { name: "Study Day", tasks: [{ title: "Focused Study", weight: 50 }, { title: "Practice/Exercises", weight: 30 }, { title: "Review Notes", weight: 20 }] },
  { name: "Balanced", tasks: [{ title: "Main Task", weight: 35 }, { title: "Secondary Task", weight: 25 }, { title: "Exercise", weight: 20 }, { title: "Personal Growth", weight: 20 }] },
];

const Tasks = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  
  useEffect(() => {
    loadTasks();
  }, []);
  
  const loadTasks = useCallback(async () => {
    const today = getTodayString();
    const draft = await getDraftTasks(today);
    
    if (draft) {
      setTasks(draft);
    } else {
      setTasks([createNewTask("Deep Work")]);
    }
    
    setLoading(false);
  }, []);
  
  const createNewTask = useCallback((title = ""): Task => {
    return {
      id: crypto.randomUUID(),
      title,
      weight: 25,
      completionPercent: 0,
      createdAt: new Date().toISOString(),
    };
  }, []);
  
  const addTask = useCallback(() => {
    setTasks(prev => [...prev, createNewTask()]);
  }, [createNewTask]);
  
  const updateTask = useCallback((id: string, updated: Task) => {
    setTasks(prev => prev.map(t => t.id === id ? updated : t));
  }, []);
  
  const deleteTask = useCallback((id: string) => {
    if (tasks.length === 1) {
      toast.error("You must have at least one task");
      return;
    }
    setTasks(prev => prev.filter(t => t.id !== id));
  }, [tasks.length]);

  const duplicateTask = useCallback((task: Task) => {
    const newTask = { ...createNewTask(task.title + " (copy)"), weight: task.weight };
    setTasks(prev => [...prev, newTask]);
    toast.success("Task duplicated");
  }, [createNewTask]);
  
  const autoNormalize = useCallback(() => {
    setTasks(prev => normalizeWeights(prev));
    toast.success("Weights normalized to 100%");
  }, []);

  const applyQuickTemplate = useCallback((template: typeof QUICK_TEMPLATES[0]) => {
    setTasks(template.tasks.map(t => ({
      id: crypto.randomUUID(),
      title: t.title,
      weight: t.weight,
      completionPercent: 0,
      createdAt: new Date().toISOString(),
    })));
    setShowTemplates(false);
    toast.success(`Applied "${template.name}" template`);
  }, []);

  const clearAllTasks = useCallback(() => {
    setTasks([createNewTask()]);
    toast.success("Tasks cleared");
  }, [createNewTask]);
  
  const saveTasks = useCallback(async () => {
    const totalWeight = tasks.reduce((sum, t) => sum + t.weight, 0);
    
    if (Math.abs(totalWeight - 100) > 0.1) {
      toast.error("Weights must sum to 100%. Use Auto-Normalize or adjust manually.");
      return;
    }
    
    for (const task of tasks) {
      if (!task.title.trim()) {
        toast.error("All tasks must have a title");
        return;
      }
      
      if (task.title.length > 200) {
        toast.error("Task titles must be less than 200 characters");
        return;
      }

      if (task.weight < 0 || task.weight > 100) {
        toast.error("Weights must be between 0 and 100");
        return;
      }
    }
    
    const today = getTodayString();
    await saveDraftTasks(today, tasks);
    await saveDefaultTemplate(tasks);
    
    toast.success("Tasks saved as your default plan!");
    navigate("/");
  }, [tasks, navigate]);

  const totalWeight = useMemo(() => tasks.reduce((sum, t) => sum + t.weight, 0), [tasks]);
  const isValid = useMemo(() => Math.abs(totalWeight - 100) < 0.1, [totalWeight]);
  const taskCategories = useMemo(() => {
    const categories: { [key: string]: number } = {};
    tasks.forEach(t => {
      const cat = t.category || 'Uncategorized';
      categories[cat] = (categories[cat] || 0) + t.weight;
    });
    return categories;
  }, [tasks]);
  
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
      <div className="w-full max-w-2xl mx-auto px-4 py-4 space-y-4">
        <div className="flex items-center justify-between pt-4">
          <div>
            <h1 className="text-2xl font-bold">Edit Plan</h1>
            <p className="text-sm text-muted-foreground">Define tasks and weights</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowTemplates(!showTemplates)}>
              <Sparkles className="h-4 w-4 mr-1" />
              Templates
            </Button>
          </div>
        </div>

        {/* Quick Templates */}
        {showTemplates && (
          <Card className="p-3">
            <div className="text-sm font-medium mb-2">Quick Templates</div>
            <div className="flex flex-wrap gap-2">
              {QUICK_TEMPLATES.map((template) => (
                <Button key={template.name} variant="outline" size="sm" onClick={() => applyQuickTemplate(template)}>
                  {template.name}
                </Button>
              ))}
            </div>
          </Card>
        )}
        
        {!isValid && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Total weight: {totalWeight.toFixed(1)}%. Must equal 100%.
              <Button 
                variant="link" 
                size="sm" 
                onClick={autoNormalize}
                className="ml-2"
              >
                Auto-Normalize
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        <Card className={isValid ? "p-4 border-success" : "p-4"}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">
              Total Weight: <span className={isValid ? "text-success" : "text-destructive"}>
                {totalWeight.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{tasks.length} tasks</Badge>
              <div className="text-xs text-muted-foreground">Target: 100%</div>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${isValid ? 'bg-success' : totalWeight > 100 ? 'bg-destructive' : 'bg-warning'}`}
              style={{ width: `${Math.min(totalWeight, 100)}%` }}
            />
          </div>
        </Card>
        
        <div className="space-y-3">
          {tasks.map((task, index) => (
            <div key={task.id} className="relative group">
              <TaskRow
                task={task}
                onUpdate={(updated) => updateTask(task.id, updated)}
                onDelete={() => deleteTask(task.id)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute -right-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                onClick={() => duplicateTask(task)}
                title="Duplicate task"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={addTask}
            className="flex-1"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
          {tasks.length > 1 && (
            <Button variant="ghost" size="icon" onClick={clearAllTasks} title="Clear all tasks">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="flex gap-2 pt-4 pb-8">
          <Button 
            onClick={saveTasks}
            disabled={!isValid}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Tasks
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
};

export default Tasks;
