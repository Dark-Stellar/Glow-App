
-- Enable RLS on health_tracking
ALTER TABLE public.health_tracking ENABLE ROW LEVEL SECURITY;

-- Owner-scoped policies
CREATE POLICY "Users can view own health data"
  ON public.health_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health data"
  ON public.health_tracking FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health data"
  ON public.health_tracking FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own health data"
  ON public.health_tracking FOR DELETE
  USING (auth.uid() = user_id);

-- Add range constraints for health data validation
ALTER TABLE public.health_tracking
  ADD CONSTRAINT check_weight_range CHECK (weight_kg > 0 AND weight_kg < 500),
  ADD CONSTRAINT check_height_range CHECK (height_cm > 0 AND height_cm < 300),
  ADD CONSTRAINT check_age_range CHECK (age > 0 AND age < 150),
  ADD CONSTRAINT check_heart_rate_range CHECK (heart_rate IS NULL OR (heart_rate >= 30 AND heart_rate <= 250)),
  ADD CONSTRAINT check_bp_range CHECK (
    (blood_pressure_systolic IS NULL OR (blood_pressure_systolic >= 50 AND blood_pressure_systolic <= 300)) AND
    (blood_pressure_diastolic IS NULL OR (blood_pressure_diastolic >= 30 AND blood_pressure_diastolic <= 200))
  ),
  ADD CONSTRAINT check_sleep_hours CHECK (sleep_hours IS NULL OR (sleep_hours >= 0 AND sleep_hours <= 24)),
  ADD CONSTRAINT check_stress_level CHECK (stress_level IS NULL OR (stress_level >= 1 AND stress_level <= 10)),
  ADD CONSTRAINT check_energy_level CHECK (energy_level IS NULL OR (energy_level >= 1 AND energy_level <= 10));
