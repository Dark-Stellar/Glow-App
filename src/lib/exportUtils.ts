import type { DailyReport, Task } from "@/types";
import html2canvas from "html2canvas";

export interface ExportStats {
  totalDays: number;
  avgProductivity: number;
  avg7Days: number;
  currentStreak: number;
  bestDay: DailyReport | null;
  todayTasks: Task[];
  todayProductivity: number;
}

export async function exportElementAsPNG(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale: 2,
  });
  const link = document.createElement("a");
  link.download = `${filename}-${new Date().toISOString().split("T")[0]}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// Helper to draw a simple bar chart in PDF
function drawBarChart(
  doc: any,
  data: { label: string; value: number; color?: [number, number, number] }[],
  x: number,
  y: number,
  width: number,
  height: number,
  maxValue: number = 100
) {
  const barWidth = width / data.length - 4;
  const chartY = y;

  // Draw axis
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(x, chartY + height, x + width, chartY + height);

  data.forEach((item, idx) => {
    const barHeight = (item.value / maxValue) * height;
    const barX = x + idx * (barWidth + 4);
    
    // Bar color
    const color = item.color || [139, 92, 246];
    doc.setFillColor(color[0], color[1], color[2]);
    
    if (item.value > 0) {
      doc.rect(barX, chartY + height - barHeight, barWidth, barHeight, "F");
    }
    
    // Label
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(item.label, barX + barWidth / 2, chartY + height + 6, { align: "center" });
    
    // Value
    if (item.value > 0) {
      doc.setTextColor(0, 0, 0);
      doc.text(`${Math.round(item.value)}%`, barX + barWidth / 2, chartY + height - barHeight - 2, { align: "center" });
    }
  });
  
  doc.setTextColor(0, 0, 0);
}

// Helper to draw a pie chart
function drawPieChart(
  doc: any,
  data: { label: string; value: number; color: [number, number, number] }[],
  centerX: number,
  centerY: number,
  radius: number
) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return;
  
  let currentAngle = -Math.PI / 2; // Start from top
  
  data.forEach((item) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const endAngle = currentAngle + sliceAngle;
    
    // Draw slice
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    
    // Create path for pie slice
    const startX = centerX + radius * Math.cos(currentAngle);
    const startY = centerY + radius * Math.sin(currentAngle);
    
    doc.moveTo(centerX, centerY);
    doc.lineTo(startX, startY);
    
    // Approximate arc with line segments
    const segments = 20;
    for (let i = 1; i <= segments; i++) {
      const angle = currentAngle + (sliceAngle * i) / segments;
      const segX = centerX + radius * Math.cos(angle);
      const segY = centerY + radius * Math.sin(angle);
      doc.lineTo(segX, segY);
    }
    
    doc.lineTo(centerX, centerY);
    
    currentAngle = endAngle;
  });
}

// Helper to draw line chart
function drawLineChart(
  doc: any,
  data: number[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number] = [139, 92, 246]
) {
  if (data.length < 2) return;
  
  const pointSpacing = width / (data.length - 1);
  
  // Draw axis
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(x, y + height, x + width, y + height);
  
  // Draw line
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(1.5);
  
  const points: { x: number; y: number }[] = [];
  data.forEach((value, idx) => {
    const px = x + idx * pointSpacing;
    const py = y + height - (value / 100) * height;
    points.push({ x: px, y: py });
  });
  
  // Draw connecting lines
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }
  
  // Draw points
  doc.setFillColor(color[0], color[1], color[2]);
  points.forEach((point, idx) => {
    doc.circle(point.x, point.y, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text(`${Math.round(data[idx])}%`, point.x, point.y - 4, { align: "center" });
  });
  
  doc.setTextColor(0, 0, 0);
}

export async function exportDashboardPDF(
  stats: ExportStats,
  reports: DailyReport[]
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF() as any;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(139, 92, 246);
  doc.rect(0, 0, 210, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text("Glow Dashboard Report", 105, 18, { align: "center" });
  doc.setFontSize(10);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, 105, 28, {
    align: "center",
  });

  doc.setTextColor(0, 0, 0);
  let yPos = 45;

  // Today's Summary
  doc.setFontSize(16);
  doc.text("Today's Summary", 14, yPos);
  yPos += 8;

  const todaySummary = [
    ["Today's Productivity", `${Math.round(stats.todayProductivity)}%`],
    ["Tasks Planned", `${stats.todayTasks.length}`],
    [
      "Tasks Completed",
      `${stats.todayTasks.filter((t) => t.completionPercent === 100).length}`,
    ],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [["Metric", "Value"]],
    body: todaySummary,
    theme: "striped",
    headStyles: { fillColor: [139, 92, 246] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Quick Stats
  doc.setFontSize(16);
  doc.text("Quick Stats", 14, yPos);
  yPos += 8;

  const quickStats = [
    ["All-time Average", `${Math.round(stats.avgProductivity)}%`],
    ["7-Day Average", `${Math.round(stats.avg7Days)}%`],
    ["Current Streak", `${stats.currentStreak} days`],
    ["Total Days Tracked", `${stats.totalDays}`],
  ];

  if (stats.bestDay) {
    quickStats.push([
      "Best Day",
      `${new Date(stats.bestDay.date).toLocaleDateString()} - ${Math.round(
        stats.bestDay.productivityPercent
      )}%`,
    ]);
  }

  autoTable(doc, {
    startY: yPos,
    head: [["Metric", "Value"]],
    body: quickStats,
    theme: "striped",
    headStyles: { fillColor: [236, 72, 153] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // 7-Day Productivity Chart
  if (reports.length >= 3) {
    doc.setFontSize(14);
    doc.text("7-Day Productivity Trend", 14, yPos);
    yPos += 8;
    
    const last7Reports = reports.slice(0, 7).reverse();
    const chartData = last7Reports.map((r, idx) => ({
      label: new Date(r.date).toLocaleDateString('en', { weekday: 'short' }),
      value: r.productivityPercent,
      color: r.productivityPercent >= 70 ? [34, 197, 94] as [number, number, number] : 
             r.productivityPercent >= 50 ? [250, 204, 21] as [number, number, number] : 
             [239, 68, 68] as [number, number, number]
    }));
    
    drawBarChart(doc, chartData, 20, yPos, 170, 40, 100);
    yPos += 55;
  }

  // Today's Tasks
  if (stats.todayTasks.length > 0) {
    doc.setFontSize(16);
    doc.text("Today's Tasks", 14, yPos);
    yPos += 8;

    const taskData = stats.todayTasks.map((t) => [
      t.title,
      `${t.weight}%`,
      `${t.completionPercent}%`,
      t.completionPercent === 100 ? "✓ Done" : "In Progress",
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Task", "Weight", "Completion", "Status"]],
      body: taskData,
      theme: "grid",
      headStyles: { fillColor: [34, 197, 94] },
    });
  }

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Glow v2.7 - Measure. Grow. Glow. | Page ${i} of ${pageCount}`,
      105,
      285,
      { align: "center" }
    );
  }

  doc.save(`glow-dashboard-${new Date().toISOString().split("T")[0]}.pdf`);
}

export async function exportInsightsPDF(
  weeklySummary: any,
  monthlySummary: any,
  bestPerformingDays: any[],
  topTasks: any[],
  aiSuggestions: string[],
  consistencyScore: number
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF() as any;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(139, 92, 246);
  doc.rect(0, 0, 210, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("Glow Insights Report", 105, 18, { align: "center" });
  doc.setFontSize(10);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, 105, 28, {
    align: "center",
  });

  doc.setTextColor(0, 0, 0);
  let yPos = 45;

  // AI Suggestions
  if (aiSuggestions.length > 0) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("AI-Powered Suggestions", 14, yPos);
    doc.setFont("helvetica", "normal");
    yPos += 8;

    aiSuggestions.forEach((suggestion, idx) => {
      const lines = doc.splitTextToSize(`${idx + 1}. ${suggestion}`, 180);
      doc.setFontSize(10);
      doc.text(lines, 14, yPos);
      yPos += lines.length * 5 + 4;
    });

    yPos += 6;
  }

  // Weekly Summary with chart
  if (weeklySummary) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("This Week's Summary", 14, yPos);
    doc.setFont("helvetica", "normal");
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [["Metric", "Value"]],
      body: [
        ["Average Productivity", `${Math.round(weeklySummary.avgProductivity)}%`],
        ["Days Tracked", `${weeklySummary.daysTracked}`],
        ["Tasks Completed", `${weeklySummary.completedTasks}`],
        ["Best Day Score", `${Math.round(weeklySummary.bestDay?.productivityPercent || 0)}%`],
      ],
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Performance by Day - Bar Chart
  if (bestPerformingDays.filter((d) => d.count > 0).length > 0) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Performance by Day", 14, yPos);
    doc.setFont("helvetica", "normal");
    yPos += 10;

    // Draw bar chart
    const chartData = bestPerformingDays
      .filter(d => d.count > 0)
      .sort((a, b) => {
        const dayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return dayOrder.indexOf(a.shortName) - dayOrder.indexOf(b.shortName);
      })
      .map(day => ({
        label: day.shortName,
        value: day.avg,
        color: day.avg >= 70 ? [34, 197, 94] as [number, number, number] : 
               day.avg >= 50 ? [250, 204, 21] as [number, number, number] : 
               [239, 68, 68] as [number, number, number]
      }));
    
    drawBarChart(doc, chartData, 20, yPos, 170, 45, 100);
    yPos += 60;

    // Table with details
    const daysData = bestPerformingDays
      .filter((d) => d.count > 0)
      .sort((a, b) => b.avg - a.avg)
      .map((day, idx) => [
        `#${idx + 1}`,
        day.name,
        `${Math.round(day.avg)}%`,
        `${day.count}x`,
      ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Rank", "Day", "Avg Productivity", "Occurrences"]],
      body: daysData,
      theme: "striped",
      headStyles: { fillColor: [34, 197, 94] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Monthly Summary with trend line
  if (monthlySummary && monthlySummary.daysTracked > 7) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Monthly Overview", 14, yPos);
    doc.setFont("helvetica", "normal");
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [["Metric", "Value"]],
      body: [
        ["Average Productivity", `${Math.round(monthlySummary.avgProductivity)}%`],
        ["Days Tracked", `${monthlySummary.daysTracked}`],
        ["Total Tasks", `${monthlySummary.totalTasks}`],
        ["Tasks Completed", `${monthlySummary.completedTasks}`],
      ],
      theme: "striped",
      headStyles: { fillColor: [139, 92, 246] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Weekly trend line chart
    if (monthlySummary.weeks && monthlySummary.weeks.length > 1) {
      doc.setFontSize(10);
      doc.text("Weekly Trend:", 14, yPos);
      yPos += 6;

      drawLineChart(doc, monthlySummary.weeks, 25, yPos, 160, 35, [139, 92, 246]);
      
      // Add week labels
      const pointSpacing = 160 / (monthlySummary.weeks.length - 1);
      monthlySummary.weeks.forEach((_: number, idx: number) => {
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(`W${idx + 1}`, 25 + idx * pointSpacing, yPos + 35 + 6, { align: "center" });
      });
      
      doc.setTextColor(0, 0, 0);
      yPos += 50;
    }
  }

  // Top Tasks with horizontal bar chart
  if (topTasks.length > 0) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Top Performing Tasks", 14, yPos);
    doc.setFont("helvetica", "normal");
    yPos += 10;

    // Horizontal bar chart
    const barChartX = 60;
    const barChartWidth = 100;
    const barHeight = 8;
    const barSpacing = 14;

    topTasks.slice(0, 5).forEach((task, idx) => {
      const taskName = task.title.length > 20 ? task.title.substring(0, 20) + "..." : task.title;
      const barWidth = (task.avg / 100) * barChartWidth;
      
      // Task name
      doc.setFontSize(9);
      doc.text(taskName, 14, yPos + barHeight / 2 + 2);
      
      // Bar background
      doc.setFillColor(230, 230, 230);
      doc.rect(barChartX, yPos, barChartWidth, barHeight, "F");
      
      // Bar fill
      if (task.avg >= 80) doc.setFillColor(34, 197, 94);
      else if (task.avg >= 60) doc.setFillColor(59, 130, 246);
      else doc.setFillColor(250, 204, 21);
      doc.rect(barChartX, yPos, barWidth, barHeight, "F");
      
      // Percentage and count
      doc.text(`${Math.round(task.avg)}% (${task.count}x)`, barChartX + barChartWidth + 5, yPos + barHeight / 2 + 2);
      
      yPos += barSpacing;
    });

    yPos += 5;

    // Table details
    const tasksData = topTasks.map((t) => [
      t.title.length > 30 ? t.title.substring(0, 30) + "..." : t.title,
      `${Math.round(t.avg)}%`,
      `${t.count}x`,
      t.category || "Other",
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Task", "Avg Completion", "Occurrences", "Category"]],
      body: tasksData,
      theme: "striped",
      headStyles: { fillColor: [236, 72, 153] },
    });
  }

  // Consistency Score with visual gauge
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Consistency Score", 14, 20);
  doc.setFont("helvetica", "normal");
  
  // Draw gauge
  const gaugeX = 105;
  const gaugeY = 55;
  const gaugeRadius = 30;
  
  // Background arc
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(8);
  doc.arc(gaugeX, gaugeY, gaugeRadius, -0.1, 3.24, "S");
  
  // Progress arc
  if (consistencyScore >= 80) doc.setDrawColor(34, 197, 94);
  else if (consistencyScore >= 60) doc.setDrawColor(59, 130, 246);
  else if (consistencyScore >= 40) doc.setDrawColor(250, 204, 21);
  else doc.setDrawColor(239, 68, 68);
  
  const progressAngle = Math.PI + (consistencyScore / 100) * Math.PI;
  doc.arc(gaugeX, gaugeY, gaugeRadius, Math.PI, progressAngle, "S");
  
  // Score text
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(`${consistencyScore}%`, gaugeX, gaugeY + 5, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const scoreText =
    consistencyScore >= 80
      ? "Excellent! You're very consistent."
      : consistencyScore >= 60
      ? "Good consistency. Keep it up!"
      : consistencyScore >= 40
      ? "Try to track more regularly for better insights."
      : "Track daily to build better habits!";
  doc.text(scoreText, gaugeX, gaugeY + 18, { align: "center" });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Glow v2.7 - Measure. Grow. Glow. | Page ${i} of ${pageCount}`,
      105,
      285,
      { align: "center" }
    );
  }

  doc.save(`glow-insights-${new Date().toISOString().split("T")[0]}.pdf`);
}