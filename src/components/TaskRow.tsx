import { Task, TASK_CATEGORIES } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, GripVertical, Tag, CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface TaskRowProps {
  task: Task;
  onUpdate: (task: Task) => void;
  onDelete: () => void;
  locked?: boolean;
}

const QUICK_COMPLETIONS = [0, 25, 50, 75, 100];

export function TaskRow({ task, onUpdate, onDelete, locked }: TaskRowProps) {
  const getStatusIcon = () => {
    if (task.completionPercent === 100) return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (task.completionPercent > 0) return <Clock className="h-4 w-4 text-warning" />;
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  const getCategoryEmoji = (category: string) => {
    const emojiMap: Record<string, string> = {
      'Work': '💼',
      'Study': '📚',
      'Health': '🏃',
      'Personal': '🎯',
      'Creative': '🎨',
      'Admin': '📋',
      'Other': '✨'
    };
    return emojiMap[category] || '✨';
  };

  return (
    <div className={cn(
      "flex items-start gap-2 p-3 bg-card border rounded-lg transition-all duration-200 hover:shadow-sm",
      task.completionPercent === 100 ? "border-success/30 bg-success/5" : "border-border"
    )}>
      <GripVertical className="h-5 w-5 text-muted-foreground mt-2 flex-shrink-0 cursor-grab active:cursor-grabbing" />
      
      <div className="flex-1 space-y-2.5">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <Input
            value={task.title}
            onChange={(e) => onUpdate({ ...task, title: e.target.value })}
            placeholder="Task title"
            className={cn("font-medium flex-1", task.completionPercent === 100 && "line-through opacity-60")}
          />
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={task.category || 'Other'}
            onValueChange={(value) => onUpdate({ ...task, category: value })}
          >
            <SelectTrigger className="h-7 text-xs w-auto gap-1 px-2">
              <span>{getCategoryEmoji(task.category || 'Other')}</span>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {TASK_CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat} className="text-xs">
                  {getCategoryEmoji(cat)} {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Badge variant="outline" className="h-7 gap-1 text-xs font-normal">
            <span className="text-muted-foreground">Weight:</span>
            <Input
              type="number"
              min="0"
              max="100"
              value={task.weight}
              onChange={(e) => onUpdate({ ...task, weight: Math.max(0, Math.min(100, Number(e.target.value))) })}
              disabled={locked}
              className="w-12 h-5 text-center p-0 border-0 bg-transparent text-xs font-medium"
            />
            <span>%</span>
          </Badge>
        </div>
        
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <div className="flex items-center gap-1">
              {QUICK_COMPLETIONS.map(val => (
                <button
                  key={val}
                  onClick={() => onUpdate({ ...task, completionPercent: val })}
                  className={cn(
                    "w-7 h-5 rounded text-[10px] font-medium transition-all",
                    task.completionPercent === val 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
          <Slider
            value={[task.completionPercent]}
            onValueChange={([value]) => onUpdate({ ...task, completionPercent: value })}
            max={100}
            step={5}
            className="w-full"
          />
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="flex-shrink-0 mt-2 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
