-- Ensure rate_limits table is ONLY writable by SECURITY DEFINER functions (like check_rate_limit)
-- Users should NEVER be able to INSERT, UPDATE, or DELETE rate limit records directly

-- Create explicit restrictive policies that deny all user write operations
-- The existing SELECT policy allows users to view their own limits, which is acceptable
-- The check_rate_limit function uses SECURITY DEFINER so it bypasses these RLS policies

-- Add restrictive INSERT policy - no direct user inserts allowed
CREATE POLICY "Deny direct user inserts to rate_limits"
ON public.rate_limits
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Add restrictive UPDATE policy - no direct user updates allowed  
CREATE POLICY "Deny direct user updates to rate_limits"
ON public.rate_limits
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- Add restrictive DELETE policy - no direct user deletes allowed
CREATE POLICY "Deny direct user deletes to rate_limits"
ON public.rate_limits
FOR DELETE
TO authenticated
USING (false);