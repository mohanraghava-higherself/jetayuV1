-- Migration v1.4: Add aircraft_history and current_aircraft_index to leads table
-- Run this in your Supabase SQL Editor

-- Add aircraft_history column (JSONB for storing list of aircraft lists)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS aircraft_history JSONB DEFAULT NULL;

-- Add current_aircraft_index column (integer index into aircraft_history)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS current_aircraft_index INTEGER DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN leads.aircraft_history IS 'JSON array of aircraft lists shown to user, for navigation history';
COMMENT ON COLUMN leads.current_aircraft_index IS 'Current index into aircraft_history for navigation';


