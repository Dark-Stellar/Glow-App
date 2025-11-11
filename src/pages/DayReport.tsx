import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Download } from "lucide-react";
import { MobileLayout } from "@/components/MobileLayout";
import { ProgressRing } from "@/components/ProgressRing";
import { TaskRow } from "@/components/TaskRow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getDailyReport, getDraftTasks, saveDailyReport, calculateProductivity, clearDraftTasks } from "@/lib/storage";
import { formatDisplayDate } from "@/lib/dates";
import type { Task, DailyReport } from "@/types";
import { toast } from "sonner";

const DayReport = () => {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (date) {
      loadDay();
    }
  }, [date]);
  
  async function loadDay() {
    if (!date) return;
    
    const report = await getDailyReport(date);
    
    if (report) {
      setTasks(report.tasks);
      setNotes(report.notes || "");
      setIsSaved(true);
    } else {
      const draft = await getDraftTasks(date);
      if (draft) {
        setTasks(draft);
      }
    }
    
    setLoading(false);
  }
  
  function updateTask(id: string, updated: Task) {
    setTasks(tasks.map(t => t.id === id ? updated : t));
  }
  
  async function saveReport() {
    if (!date) return;
    
    const productivity = calculateProductivity(tasks);
    
    const report: DailyReport = {
      id: crypto.randomUUID(),
      date,
      tasks,
      productivityPercent: productivity,
      notes,
      createdAt: new Date().toISOString(),
      version: 1,
    };
    
    await saveDailyReport(report);
    await clearDraftTasks(date);
    setIsSaved(true);
    toast.success("Daily report saved!");
  }
  
  function exportData() {
    const productivity = calculateProductivity(tasks);
    const data = {
      date,
      productivity: `${productivity}%`,
      tasks: tasks.map(t => ({
        title: t.title,
        weight: `${t.weight}%`,
        completion: `${t.completionPercent}%`,
      })),
      notes,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `glow-report-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Report exported!");
  }
  
  if (loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </MobileLayout>
    );
  }
  
  if (!tasks.length) {
    return (
      <MobileLayout>
        <div className="container max-w-2xl mx-auto p-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">No data for this day</p>
          </Card>
        </div>
      </MobileLayout>
    );
  }
  
  const productivity = calculateProductivity(tasks);
  
  return (
    <MobileLayout>
      <div className="container max-w-2xl mx-auto p-4 space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="text-center">
          <h1 className="text-2xl font-bold">{date && formatDisplayDate(new Date(date))}</h1>
          {isSaved && (
            <p className="text-sm text-success">✓ Saved</p>
          )}
        </div>
        
        <div className="flex justify-center py-4">
          <ProgressRing progress={productivity} />
        </div>
        
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onUpdate={(updated) => updateTask(task.id, updated)}
              onDelete={() => {}}
              locked={isSaved}
            />
          ))}
        </div>
        
        <Card className="p-4">
          <label className="text-sm font-medium mb-2 block">Notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about your day..."
            rows={4}
            disabled={isSaved}
          />
        </Card>
        
        <div className="flex gap-2 pb-8">
          {!isSaved && (
            <Button onClick={saveReport} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              Save Report
            </Button>
          )}
          <Button onClick={exportData} variant="outline" className={isSaved ? "flex-1" : ""}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
};

export default DayReport;
