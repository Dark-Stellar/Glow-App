-- Fix foreign key reference in productivity_goals table
ALTER TABLE public.productivity_goals
DROP CONSTRAINT IF EXISTS productivity_goals_user_id_fkey;

ALTER TABLE public.productivity_goals
ADD CONSTRAINT productivity_goals_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;