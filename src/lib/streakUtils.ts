import type { DailyReport } from "@/types";

/**
 * Normalize a date string (YYYY-MM-DD) to local date comparison.
 * Avoids UTC vs local timezone issues.
 */
function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Calculate the current streak of consecutive days with productivity >= threshold.
 * Reports must be sorted descending by date.
 */
export function calculateCurrentStreak(reports: DailyReport[], threshold = 60): number {
  if (reports.length === 0) return 0;
  
  const today = new Date();
  const todayStr = toLocalDateStr(today);
  let streak = 0;
  
  // Check from today backwards
  for (let i = 0; i <= reports.length + 30; i++) {
    const checkDate = toLocalDateStr(addDays(today, -i));
    const report = reports.find(r => r.date === checkDate);
    
    if (report && report.productivityPercent >= threshold) {
      streak++;
    } else if (i === 0) {
      // Today might not have a report yet, that's ok - continue checking
      continue;
    } else {
      break;
    }
  }
  
  return streak;
}

/**
 * Calculate best ever streak.
 */
export function calculateBestStreak(reports: DailyReport[], threshold = 60): number {
  if (reports.length === 0) return 0;
  
  const sorted = [...reports].sort((a, b) => a.date.localeCompare(b.date));
  let bestStreak = 0;
  let currentStreak = 0;
  
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].productivityPercent >= threshold) {
      if (i === 0) {
        currentStreak = 1;
      } else {
        // Check if consecutive day
        const prevDate = new Date(sorted[i - 1].date + 'T12:00:00');
        const currDate = new Date(sorted[i].date + 'T12:00:00');
        const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      }
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  
  return bestStreak;
}

/**
 * Get heatmap data for the last N days.
 */
export function getHeatmapData(reports: DailyReport[], daysToShow = 28) {
  const reportMap = new Map(reports.map(r => [r.date, r.productivityPercent]));
  const days: { date: Date; dateStr: string; productivity: number | null; dayName: string }[] = [];
  
  const today = new Date();
  for (let i = daysToShow - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const dateStr = toLocalDateStr(date);
    const productivity = reportMap.get(dateStr) ?? null;
    days.push({
      date,
      dateStr,
      productivity,
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
    });
  }
  
  return days;
}
