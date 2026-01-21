-- Fix the overly permissive RLS policy
-- Drop the permissive policy and rely on the service role for edge function access
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limits;

-- Rate limits are managed by the database function which runs as SECURITY DEFINER
-- No additional policies needed since:
-- 1. Users can view their own limits (existing policy)
-- 2. The check_rate_limit function handles inserts/updates as SECURITY DEFINER