-- Jetayu Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Conversations table
-- Stores all chat messages for history and context
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster session lookups
CREATE INDEX idx_conversations_session_id ON conversations(session_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);

-- Leads table
-- Stores extracted lead information
-- Status: draft (conversation in progress), confirmed (user wants to book), contacted (ops followed up)
CREATE TABLE leads (
    session_id UUID PRIMARY KEY,
    name TEXT,
    email TEXT,
    date_time TEXT,
    route_from TEXT,
    route_to TEXT,
    pax INTEGER,
    special_requests TEXT[] DEFAULT '{}',
    selected_aircraft TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'contacted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for filtering by status (operators query confirmed leads)
CREATE INDEX idx_leads_status ON leads(status);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (optional but recommended)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (adjust based on your auth setup)
CREATE POLICY "Allow all operations on conversations" ON conversations
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on leads" ON leads
    FOR ALL USING (true) WITH CHECK (true);

