-- Create rate_limits table for tracking API usage
CREATE TABLE public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_rate_limits_user_endpoint ON public.rate_limits(user_id, endpoint, window_start);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own rate limits (for debugging)
CREATE POLICY "Users can view their own rate limits"
  ON public.rate_limits FOR SELECT
  USING (auth.uid() = user_id);

-- Allow service role to manage rate limits (edge functions use service role)
CREATE POLICY "Service role can manage rate limits"
  ON public.rate_limits FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to check and update rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_max_requests INTEGER DEFAULT 10,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  v_window_start := now() - (p_window_minutes || ' minutes')::INTERVAL;
  v_reset_at := now() + (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Clean up old records (older than 24 hours)
  DELETE FROM public.rate_limits 
  WHERE window_start < now() - INTERVAL '24 hours';
  
  -- Get current count in window
  SELECT COALESCE(SUM(request_count), 0) INTO v_current_count
  FROM public.rate_limits
  WHERE user_id = p_user_id 
    AND endpoint = p_endpoint 
    AND window_start > v_window_start;
  
  -- Check if allowed
  IF v_current_count >= p_max_requests THEN
    RETURN QUERY SELECT false, 0, v_reset_at;
    RETURN;
  END IF;
  
  -- Insert new rate limit record
  INSERT INTO public.rate_limits (user_id, endpoint, request_count, window_start)
  VALUES (p_user_id, p_endpoint, 1, now());
  
  RETURN QUERY SELECT true, (p_max_requests - v_current_count - 1), v_reset_at;
END;
$$;