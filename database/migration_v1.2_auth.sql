-- Migration for Jetayu v1.2 - Authentication & User Profiles
-- Adds user authentication, profiles table, and user association to leads
-- Run this after schema.sql and migration_v1.1.sql

-- ============================================
-- Profiles Table
-- ============================================
-- Thin extension over Supabase auth.users
-- Stores minimal profile data (email, name)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_profiles_updated_at();

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NULL)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Leads Table Modifications
-- ============================================
-- Add user_id column (nullable for anonymous leads)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Index for user_id lookups (for My Bookings queries)
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read/write only their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Leads: Update RLS policies
-- Drop old "allow all" policy
DROP POLICY IF EXISTS "Allow all operations on leads" ON leads;

-- Anonymous users: NO read access (can only create/update via backend service role)
-- Authenticated users: read only their own leads
DROP POLICY IF EXISTS "Users can view own leads" ON leads;
CREATE POLICY "Users can view own leads" ON leads
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND user_id = auth.uid()
    );

-- Backend service role can access all leads (for /start and /chat endpoints)
-- Service role key automatically bypasses RLS, so no policy needed
-- RLS policies only apply to anon/authenticated users
-- IMPORTANT: Backend must use SUPABASE_SERVICE_KEY (not anon key) to bypass RLS

-- ============================================
-- Done!
-- ============================================
-- Your database now supports:
-- 1. User authentication via Supabase Auth
-- 2. User profiles linked to auth.users
-- 3. Leads associated with users (nullable for anonymous)
-- 4. Proper RLS for data security

