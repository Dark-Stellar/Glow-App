import { MobileLayout } from "@/components/MobileLayout";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, Database, Info } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  function handleExportAll() {
    toast.info("Export feature coming soon!");
  }
  
  return (
    <MobileLayout>
      <div className="container max-w-2xl mx-auto p-4 space-y-4">
        <div className="pt-4">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure your preferences</p>
        </div>
        
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Notifications</h3>
              <p className="text-xs text-muted-foreground">Reminder settings</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="notifications" className="text-sm">Enable Notifications</Label>
              <Switch id="notifications" />
            </div>
            
            <div className="text-xs text-muted-foreground">
              Morning and evening reminders to plan and log your day
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Database className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold">Data</h3>
              <p className="text-xs text-muted-foreground">Manage your data</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <Button variant="outline" className="w-full" onClick={handleExportAll}>
              Export All Data
            </Button>
            <p className="text-xs text-muted-foreground">
              Download all your reports and settings as JSON
            </p>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center">
              <Info className="h-5 w-5 text-info" />
            </div>
            <div>
              <h3 className="font-semibold">About Glow</h3>
              <p className="text-xs text-muted-foreground">App information</p>
            </div>
          </div>
          
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Version 1.0.0</p>
            <p className="text-xs">Measure. Grow. Glow.</p>
            <p className="text-xs">
              Track your daily productivity with weighted tasks and visual progress tracking.
            </p>
          </div>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default Settings;
