import { z } from 'zod';

/**
 * Security validation schemas for user inputs
 * These prevent malicious or malformed data from reaching the database
 */

export const taskSchema = z.object({
  id: z.string().uuid(),
  title: z.string()
    .trim()
    .min(1, 'Task title cannot be empty')
    .max(200, 'Task title must be less than 200 characters'),
  weight: z.number()
    .min(0, 'Weight cannot be negative')
    .max(100, 'Weight cannot exceed 100%'),
  completionPercent: z.number()
    .min(0, 'Completion cannot be negative')
    .max(100, 'Completion cannot exceed 100%'),
  category: z.string().max(50).optional(),
  isMajor: z.boolean().optional(),
});

export const tasksArraySchema = z.array(taskSchema)
  .min(1, 'At least one task is required');

export const notesSchema = z.string()
  .max(5000, 'Notes must be less than 5000 characters')
  .optional();

export const templateSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Template title cannot be empty')
    .max(200, 'Template title must be less than 200 characters'),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  tasks: tasksArraySchema,
});

export const dailyReportSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  tasks: tasksArraySchema,
  notes: notesSchema,
  productivityPercent: z.number()
    .min(0, 'Productivity cannot be negative')
    .max(100, 'Productivity cannot exceed 100%'),
});

export const healthDataSchema = z.object({
  weight_kg: z.number().positive('Weight must be positive').max(499, 'Weight must be under 500kg'),
  height_cm: z.number().positive('Height must be positive').max(299, 'Height must be under 300cm'),
  age: z.number().int().positive('Age must be positive').max(149, 'Age must be under 150'),
  gender: z.enum(['male', 'female']),
  activity_level: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  heart_rate: z.number().int().min(30).max(250).nullable().optional(),
  blood_pressure_systolic: z.number().int().min(50).max(300).nullable().optional(),
  blood_pressure_diastolic: z.number().int().min(30).max(200).nullable().optional(),
  sleep_hours: z.number().min(0).max(24).nullable().optional(),
  stress_level: z.number().int().min(1).max(10).nullable().optional(),
  energy_level: z.number().int().min(1).max(10).nullable().optional(),
  steps: z.number().int().min(0).nullable().optional(),
  water_glasses: z.number().int().min(0).nullable().optional(),
  calories_consumed: z.number().int().min(0).nullable().optional(),
  calories_burned: z.number().int().min(0).nullable().optional(),
  body_fat_percent: z.number().min(0).max(100).nullable().optional(),
  waist_cm: z.number().positive().max(300).nullable().optional(),
  exercise_minutes: z.number().int().min(0).nullable().optional(),
});

export type ValidatedTask = z.infer<typeof taskSchema>;
export type ValidatedTemplate = z.infer<typeof templateSchema>;
export type ValidatedDailyReport = z.infer<typeof dailyReportSchema>;
export type ValidatedHealthData = z.infer<typeof healthDataSchema>;
