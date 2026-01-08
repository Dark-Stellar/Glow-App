import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
  showAnimation?: boolean;
}

export function ProgressRing({ 
  progress, 
  size = 144, 
  strokeWidth = 10,
  className,
  label = "Today",
  showAnimation = true
}: ProgressRingProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (animatedProgress / 100) * circumference;
  
  useEffect(() => {
    if (showAnimation) {
      const timer = setTimeout(() => setAnimatedProgress(progress), 100);
      return () => clearTimeout(timer);
    } else {
      setAnimatedProgress(progress);
    }
  }, [progress, showAnimation]);
  
  const getColorClass = () => {
    if (animatedProgress >= 80) return "stroke-success";
    if (animatedProgress >= 60) return "stroke-primary";
    if (animatedProgress >= 40) return "stroke-warning";
    return "stroke-destructive";
  };

  const getLabel = () => {
    if (animatedProgress >= 80) return "🔥 Excellent!";
    if (animatedProgress >= 60) return "💪 Good!";
    if (animatedProgress >= 40) return "📈 Fair";
    if (animatedProgress > 0) return "🎯 Keep going";
    return label;
  };

  return (
    <div className={cn("relative group", className)} style={{ width: size, height: size }}>
      {/* Glow effect */}
      <div 
        className={cn(
          "absolute inset-0 rounded-full blur-xl opacity-30 transition-opacity duration-500",
          animatedProgress >= 80 ? "bg-success" : 
          animatedProgress >= 60 ? "bg-primary" : 
          animatedProgress >= 40 ? "bg-warning" : "bg-destructive"
        )}
      />
      <svg className="transform -rotate-90 relative z-10" width={size} height={size}>
        <circle
          className="stroke-muted"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={cn("transition-all duration-1000 ease-out", getColorClass())}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <div className="text-3xl font-bold text-foreground transition-all duration-300">
          {Math.round(animatedProgress)}%
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{getLabel()}</div>
      </div>
    </div>
  );
}
