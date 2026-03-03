import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Briefcase, User, Heart, BookOpen, Palette, Users, 
  DollarSign, MoreHorizontal, PieChart
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyReport } from "@/types";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  Work: { icon: Briefcase, color: '#8B5CF6' },
  Personal: { icon: User, color: '#F59E0B' },
  Health: { icon: Heart, color: '#EF4444' },
  Learning: { icon: BookOpen, color: '#3B82F6' },
  Creative: { icon: Palette, color: '#EC4899' },
  Social: { icon: Users, color: '#10B981' },
  Finance: { icon: DollarSign, color: '#14B8A6' },
  Other: { icon: MoreHorizontal, color: '#6B7280' },
};

interface TaskCategoriesProps {
  reports: DailyReport[];
  showChart?: boolean;
}

export function TaskCategories({ reports, showChart = true }: TaskCategoriesProps) {
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; totalCompletion: number; totalWeight: number }> = {};
    
    reports.forEach(r => {
      r.tasks.forEach(t => {
        const category = t.category || 'Other';
        if (!stats[category]) {
          stats[category] = { count: 0, totalCompletion: 0, totalWeight: 0 };
        }
        stats[category].count++;
        stats[category].totalCompletion += t.completionPercent;
        stats[category].totalWeight += t.weight;
      });
    });
    
    return Object.entries(stats)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgCompletion: data.count > 0 ? data.totalCompletion / data.count : 0,
        totalWeight: data.totalWeight,
        config: CATEGORY_CONFIG[name] || CATEGORY_CONFIG.Other,
      }))
      .sort((a, b) => b.count - a.count);
  }, [reports]);

  const chartData = useMemo(() => 
    categoryStats.map(c => ({
      name: c.name,
      value: c.count,
      color: c.config.color,
    }))
  , [categoryStats]);

  const totalTasks = categoryStats.reduce((s, c) => s + c.count, 0);

  if (categoryStats.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <PieChart className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Task Categories</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          No category data yet. Add categories to your tasks to see insights.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Task Categories</h3>
      </div>

      {showChart && chartData.length > 0 && (
        <div className="h-40 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPie>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value} tasks`, 'Count']}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
            </RechartsPie>
          </ResponsiveContainer>
        </div>
      )}

      <div className="space-y-3">
        {categoryStats.slice(0, 6).map(category => {
          const Icon = category.config.icon;
          const percentage = (category.count / totalTasks) * 100;
          
          return (
            <div key={category.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="h-6 w-6 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${category.config.color}20` }}
                  >
                    <Icon 
                      className="h-3.5 w-3.5" 
                      style={{ color: category.config.color }}
                    />
                  </div>
                  <span className="text-sm font-medium">{category.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {category.count} tasks
                  </span>
                  <span className="text-xs font-medium" style={{ color: category.config.color }}>
                    {Math.round(category.avgCompletion)}%
                  </span>
                </div>
              </div>
              <Progress 
                value={percentage} 
                className="h-1.5"
                style={{ 
                  '--progress-color': category.config.color 
                } as React.CSSProperties}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
