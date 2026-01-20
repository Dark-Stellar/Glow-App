-- Add new columns to health_tracking for comprehensive health features
ALTER TABLE public.health_tracking 
ADD COLUMN IF NOT EXISTS sleep_hours numeric,
ADD COLUMN IF NOT EXISTS sleep_quality text,
ADD COLUMN IF NOT EXISTS steps integer,
ADD COLUMN IF NOT EXISTS water_glasses integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS calories_consumed integer,
ADD COLUMN IF NOT EXISTS calories_burned integer,
ADD COLUMN IF NOT EXISTS mood text,
ADD COLUMN IF NOT EXISTS mood_notes text,
ADD COLUMN IF NOT EXISTS heart_rate integer,
ADD COLUMN IF NOT EXISTS blood_pressure_systolic integer,
ADD COLUMN IF NOT EXISTS blood_pressure_diastolic integer,
ADD COLUMN IF NOT EXISTS body_fat_percent numeric,
ADD COLUMN IF NOT EXISTS waist_cm numeric,
ADD COLUMN IF NOT EXISTS exercise_minutes integer,
ADD COLUMN IF NOT EXISTS exercise_type text,
ADD COLUMN IF NOT EXISTS stress_level integer,
ADD COLUMN IF NOT EXISTS energy_level integer;

-- Create achievements table for gamification
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_type text NOT NULL,
  achievement_name text NOT NULL,
  description text,
  earned_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

-- Enable RLS on achievements
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for achievements
CREATE POLICY "Users can view their own achievements" 
ON public.achievements FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements" 
ON public.achievements FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own achievements" 
ON public.achievements FOR DELETE 
USING (auth.uid() = user_id);

-- Create focus_sessions table for focus timer feature
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  duration_minutes integer NOT NULL,
  task_title text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  is_completed boolean NOT NULL DEFAULT false,
  focus_type text DEFAULT 'pomodoro'
);

-- Enable RLS on focus_sessions
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for focus_sessions
CREATE POLICY "Users can view their own focus sessions" 
ON public.focus_sessions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own focus sessions" 
ON public.focus_sessions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own focus sessions" 
ON public.focus_sessions FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own focus sessions" 
ON public.focus_sessions FOR DELETE 
USING (auth.uid() = user_id);

-- Create habit_streaks table for habit tracking
CREATE TABLE IF NOT EXISTS public.habit_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  habit_name text NOT NULL,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_completed_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on habit_streaks
ALTER TABLE public.habit_streaks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for habit_streaks
CREATE POLICY "Users can view their own habit streaks" 
ON public.habit_streaks FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own habit streaks" 
ON public.habit_streaks FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habit streaks" 
ON public.habit_streaks FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habit streaks" 
ON public.habit_streaks FOR DELETE 
USING (auth.uid() = user_id);