-- Migration for Jetayu v1.1
-- Adds booking flow fields: status and selected_aircraft
-- Run this if you already have the base schema installed

-- Add status column (default 'draft' for existing records)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' 
CHECK (status IN ('draft', 'confirmed', 'contacted'));

-- Add selected_aircraft column
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS selected_aircraft TEXT;

-- Create index for status filtering (operators query confirmed leads)
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- Update any NULL status values to 'draft'
UPDATE leads SET status = 'draft' WHERE status IS NULL;

-- Done! Your leads table now supports the booking flow.

