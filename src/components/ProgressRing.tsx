import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showGlow?: boolean;
}

export function ProgressRing({ 
  progress, 
  size = 144, 
  strokeWidth = 10,
  className,
  showGlow = true
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  
  // Dynamic color based on productivity percentage
  const colors = useMemo(() => {
    if (progress >= 80) {
      return {
        stroke: "stroke-success",
        glow: "rgba(34, 197, 94, 0.6)",
        glowLight: "rgba(34, 197, 94, 0.2)",
        bg: "from-success/20 to-success/5",
        text: "text-success"
      };
    }
    if (progress >= 60) {
      return {
        stroke: "stroke-primary",
        glow: "rgba(139, 92, 246, 0.6)",
        glowLight: "rgba(139, 92, 246, 0.2)",
        bg: "from-primary/20 to-primary/5",
        text: "text-primary"
      };
    }
    if (progress >= 40) {
      return {
        stroke: "stroke-warning",
        glow: "rgba(234, 179, 8, 0.6)",
        glowLight: "rgba(234, 179, 8, 0.2)",
        bg: "from-warning/20 to-warning/5",
        text: "text-warning"
      };
    }
    return {
      stroke: "stroke-destructive",
      glow: "rgba(239, 68, 68, 0.6)",
      glowLight: "rgba(239, 68, 68, 0.2)",
      bg: "from-destructive/20 to-destructive/5",
      text: "text-destructive"
    };
  }, [progress]);

  const glowIntensity = useMemo(() => {
    // More glow for higher percentages
    const base = Math.min(progress / 100, 1);
    return {
      blur: 20 + base * 30, // 20-50px blur
      spread: 10 + base * 20, // 10-30px spread
      opacity: 0.3 + base * 0.4 // 0.3-0.7 opacity
    };
  }, [progress]);

  return (
    <div 
      className={cn(
        "relative",
        showGlow && "animate-float",
        className
      )} 
      style={{ width: size, height: size }}
    >
      {/* Background glow effect */}
      {showGlow && (
        <div 
          className="absolute inset-0 rounded-full transition-all duration-700"
          style={{
            background: `radial-gradient(circle, ${colors.glow} 0%, ${colors.glowLight} 50%, transparent 70%)`,
            filter: `blur(${glowIntensity.blur}px)`,
            opacity: glowIntensity.opacity,
            transform: 'scale(1.3)',
          }}
        />
      )}
      
      {/* Secondary pulse glow */}
      {showGlow && progress > 0 && (
        <div 
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            background: `radial-gradient(circle, ${colors.glow} 0%, transparent 60%)`,
            filter: `blur(${glowIntensity.blur * 0.7}px)`,
            opacity: glowIntensity.opacity * 0.5,
            transform: 'scale(1.15)',
          }}
        />
      )}
      
      {/* SVG Ring */}
      <svg className="transform -rotate-90 relative z-10" width={size} height={size}>
        {/* Glow filter for the stroke */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background circle */}
        <circle
          className="stroke-muted"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        
        {/* Progress circle with glow */}
        <circle
          className={cn("transition-all duration-700", colors.stroke)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          filter={showGlow ? "url(#glow)" : undefined}
          style={{
            filter: showGlow ? `drop-shadow(0 0 ${glowIntensity.spread / 2}px ${colors.glow})` : undefined
          }}
        />
      </svg>
      {/* Center content with gradient background */}
      <div 
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center",
          "rounded-full"
        )}
        style={{
          inset: strokeWidth + 4,
        }}
      >
        <div 
          className={cn(
            "absolute inset-0 rounded-full bg-gradient-to-br opacity-30",
            colors.bg
          )}
        />
        <div className={cn("text-3xl font-bold relative z-10", colors.text)}>
          {Math.round(progress)}%
        </div>
        <div className="text-xs text-muted-foreground relative z-10">Today</div>
      </div>
    </div>
  );
}