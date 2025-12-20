-- Migration v1.3: Add submission_state to track booking submission flow
-- This prevents booking confirmation without authentication

-- Add submission_state column to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS submission_state TEXT DEFAULT 'collecting' 
CHECK (submission_state IN ('collecting', 'awaiting_auth', 'confirmed'));

-- Create index for submission_state queries
CREATE INDEX IF NOT EXISTS idx_leads_submission_state ON leads(submission_state);

-- Update existing leads to have 'collecting' state (or 'confirmed' if already confirmed)
UPDATE leads 
SET submission_state = CASE 
    WHEN status = 'confirmed' THEN 'confirmed'
    ELSE 'collecting'
END
WHERE submission_state IS NULL;

-- Done! Now leads have explicit submission state tracking

