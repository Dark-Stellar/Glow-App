-- Fix rate_limits RLS - only the database function (SECURITY DEFINER) should modify it
-- Users cannot directly INSERT/UPDATE/DELETE rate limits

-- The check_rate_limit function runs as SECURITY DEFINER so it can insert/update
-- No additional policies needed for user INSERT/UPDATE/DELETE since:
-- 1. The function handles all rate limit operations
-- 2. Direct user modifications are blocked by RLS (no policies = no access)

-- Add UPDATE policy for achievements so users can update their own
CREATE POLICY "Users can update their own achievements"
  ON public.achievements FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);