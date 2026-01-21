-- Remove the email column from profiles table since Supabase Auth manages emails securely
-- This prevents potential email data exposure via the profiles table

-- Drop the email column from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- Update the handle_new_user function to not store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, created_at)
  VALUES (new.id, now());
  RETURN new;
END;
$$;