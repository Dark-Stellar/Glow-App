export interface Task {
  id: string;
  title: string;
  description?: string;
  weight: number;
  category?: string;
  dueTime?: string;
  estimatedDuration?: number;
  completionPercent: number;
  createdAt: string;
}

export interface DailyReport {
  id: string;
  date: string;
  tasks: Task[];
  productivityPercent: number;
  notes?: string;
  createdAt: string;
  version: number;
}

export interface Template {
  id: string;
  title: string;
  description?: string;
  tasks: Omit<Task, 'id' | 'completionPercent' | 'createdAt'>[];
  createdAt: string;
}

export interface UserPreferences {
  id?: string;
  morningReminderTime?: string;
  eveningReminderTime?: string;
  notificationsEnabled: boolean;
  maxMajorTasks: number;
  timezone: string;
}

export interface ProductivityGoal {
  id: string;
  goalType: 'weekly' | 'monthly';
  targetPercentage: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export const TASK_CATEGORIES = [
  'Work',
  'Personal',
  'Health',
  'Learning',
  'Creative',
  'Social',
  'Finance',
  'Other'
] as const;

export type TaskCategory = typeof TASK_CATEGORIES[number];
