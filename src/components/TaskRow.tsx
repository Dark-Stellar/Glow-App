import { Task, TASK_CATEGORIES } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, GripVertical, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskRowProps {
  task: Task;
  onUpdate: (task: Task) => void;
  onDelete: () => void;
  locked?: boolean;
}

export function TaskRow({ task, onUpdate, onDelete, locked }: TaskRowProps) {
  return (
    <div className="flex items-start gap-2 p-3 bg-card border border-border rounded-lg">
      <GripVertical className="h-5 w-5 text-muted-foreground mt-2 flex-shrink-0" />
      
      <div className="flex-1 space-y-2">
        <Input
          value={task.title}
          onChange={(e) => onUpdate({ ...task, title: e.target.value })}
          placeholder="Task title"
          className="font-medium"
        />
        
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Select
            value={task.category || 'Other'}
            onValueChange={(value) => onUpdate({ ...task, category: value })}
          >
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {TASK_CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat} className="text-xs">
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-muted-foreground">Weight:</span>
            <Input
              type="number"
              min="0"
              max="100"
              value={task.weight}
              onChange={(e) => onUpdate({ ...task, weight: Math.max(0, Math.min(100, Number(e.target.value))) })}
              disabled={locked}
              className="w-16 text-center"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          
          <div className={cn(
            "px-2 py-1 rounded-full text-xs font-medium",
            task.completionPercent === 100 ? "bg-success/10 text-success" :
            task.completionPercent >= 50 ? "bg-warning/10 text-warning" :
            task.completionPercent > 0 ? "bg-info/10 text-info" :
            "bg-muted text-muted-foreground"
          )}>
            {task.completionPercent}%
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Completion</span>
            <span>{task.completionPercent}%</span>
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
        className="flex-shrink-0 mt-2"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
