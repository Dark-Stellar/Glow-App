import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { DailyReport, Template, Task, UserPreferences } from '@/types';

interface GlowDB extends DBSchema {
  dailyReports: {
    key: string;
    value: DailyReport;
    indexes: { 'by-date': string };
  };
  templates: {
    key: string;
    value: Template;
  };
  preferences: {
    key: string;
    value: UserPreferences;
  };
  draftTasks: {
    key: string;
    value: { date: string; tasks: Task[] };
  };
}

let db: IDBPDatabase<GlowDB> | null = null;

export async function initDB() {
  if (db) return db;
  
  db = await openDB<GlowDB>('glow-db', 1, {
    upgrade(db) {
      // Daily reports store
      const reportStore = db.createObjectStore('dailyReports', { keyPath: 'id' });
      reportStore.createIndex('by-date', 'date');
      
      // Templates store
      db.createObjectStore('templates', { keyPath: 'id' });
      
      // Preferences store
      db.createObjectStore('preferences', { keyPath: 'id' });
      
      // Draft tasks store (for today's work in progress)
      db.createObjectStore('draftTasks', { keyPath: 'date' });
    },
  });
  
  return db;
}

// Daily Reports
export async function saveDailyReport(report: DailyReport) {
  const database = await initDB();
  await database.put('dailyReports', report);
}

export async function getDailyReport(date: string): Promise<DailyReport | undefined> {
  const database = await initDB();
  const reports = await database.getAllFromIndex('dailyReports', 'by-date', date);
  return reports[0];
}

export async function getAllDailyReports(): Promise<DailyReport[]> {
  const database = await initDB();
  return database.getAll('dailyReports');
}

export async function getReportsInRange(startDate: string, endDate: string): Promise<DailyReport[]> {
  const database = await initDB();
  const allReports = await database.getAll('dailyReports');
  return allReports.filter(r => r.date >= startDate && r.date <= endDate);
}

// Templates
export async function saveTemplate(template: Template) {
  const database = await initDB();
  await database.put('templates', template);
}

export async function getTemplate(id: string): Promise<Template | undefined> {
  const database = await initDB();
  return database.get('templates', id);
}

export async function getAllTemplates(): Promise<Template[]> {
  const database = await initDB();
  return database.getAll('templates');
}

export async function deleteTemplate(id: string) {
  const database = await initDB();
  await database.delete('templates', id);
}

// Draft Tasks (work in progress for a specific date)
export async function saveDraftTasks(date: string, tasks: Task[]) {
  const database = await initDB();
  await database.put('draftTasks', { date, tasks });
}

export async function getDraftTasks(date: string): Promise<Task[] | undefined> {
  const database = await initDB();
  const draft = await database.get('draftTasks', date);
  return draft?.tasks;
}

export async function clearDraftTasks(date: string) {
  const database = await initDB();
  await database.delete('draftTasks', date);
}

// Preferences
export async function savePreferences(preferences: UserPreferences) {
  const database = await initDB();
  await database.put('preferences', preferences as any);
}

export async function getPreferences(): Promise<UserPreferences | undefined> {
  const database = await initDB();
  return database.get('preferences', 'user-preferences');
}

// Utility: Calculate productivity
export function calculateProductivity(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  
  const totalWeight = tasks.reduce((sum, task) => sum + task.weight, 0);
  if (totalWeight === 0) return 0;
  
  const weightedCompletion = tasks.reduce(
    (sum, task) => sum + (task.weight * task.completionPercent) / 100,
    0
  );
  
  return Math.round((weightedCompletion / totalWeight) * 100 * 100) / 100;
}

// Utility: Normalize weights to sum to 100
export function normalizeWeights(tasks: Task[]): Task[] {
  const totalWeight = tasks.reduce((sum, task) => sum + task.weight, 0);
  
  if (totalWeight === 0) {
    const equalWeight = Math.round((100 / tasks.length) * 100) / 100;
    return tasks.map(task => ({ ...task, weight: equalWeight }));
  }
  
  if (totalWeight === 100) return tasks;
  
  const scale = 100 / totalWeight;
  let normalized = tasks.map(task => ({
    ...task,
    weight: Math.round(task.weight * scale * 100) / 100,
  }));
  
  // Fix rounding errors
  const newTotal = normalized.reduce((sum, task) => sum + task.weight, 0);
  if (newTotal !== 100 && normalized.length > 0) {
    normalized[0].weight = Math.round((normalized[0].weight + (100 - newTotal)) * 100) / 100;
  }
  
  return normalized;
}
