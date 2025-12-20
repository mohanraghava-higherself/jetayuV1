-- QUICK FIX: Restore permissive policy for leads table
-- Run this in Supabase SQL Editor to fix 401 errors immediately
-- This allows backend to work with anon key until you add SUPABASE_SERVICE_KEY

-- Restore the "allow all" policy that was dropped by migration_v1.2_auth.sql
CREATE POLICY IF NOT EXISTS "Allow all operations on leads" ON leads
    FOR ALL USING (true) WITH CHECK (true);

-- This will fix the 401 errors immediately
-- Later, when you add SUPABASE_SERVICE_KEY to backend/.env, you can:
-- 1. Remove this policy: DROP POLICY "Allow all operations on leads" ON leads;
-- 2. The service role key will bypass RLS automatically

