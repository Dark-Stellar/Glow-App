-- Create productivity_goals table
CREATE TABLE IF NOT EXISTS public.productivity_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  goal_type text NOT NULL CHECK (goal_type IN ('weekly', 'monthly')),
  target_percentage numeric NOT NULL CHECK (target_percentage >= 0 AND target_percentage <= 100),
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.productivity_goals ENABLE ROW LEVEL SECURITY;

-- RLS policies for productivity_goals
CREATE POLICY "Users can view their own goals"
  ON public.productivity_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
  ON public.productivity_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
  ON public.productivity_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
  ON public.productivity_goals FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_productivity_goals_updated_at
  BEFORE UPDATE ON public.productivity_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();