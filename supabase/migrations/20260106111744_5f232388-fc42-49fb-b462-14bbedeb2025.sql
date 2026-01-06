-- Create health_tracking table for BMI/BMR data
CREATE TABLE public.health_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric NOT NULL,
  height_cm numeric NOT NULL,
  age integer NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male', 'female')),
  activity_level text NOT NULL DEFAULT 'sedentary' CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  bmi numeric GENERATED ALWAYS AS (weight_kg / ((height_cm / 100) * (height_cm / 100))) STORED,
  bmr numeric GENERATED ALWAYS AS (
    CASE 
      WHEN gender = 'male' THEN (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5
      ELSE (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161
    END
  ) STORED,
  notes text,
  ai_feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- Enable RLS
ALTER TABLE public.health_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own health records"
ON public.health_tracking FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own health records"
ON public.health_tracking FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own health records"
ON public.health_tracking FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own health records"
ON public.health_tracking FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_health_tracking_updated_at
BEFORE UPDATE ON public.health_tracking
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();