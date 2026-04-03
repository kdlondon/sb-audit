-- =============================================
-- COMMUNICATION INTENT MIGRATION
-- Run this in Supabase → SQL Editor
-- =============================================

ALTER TABLE audit_entries ADD COLUMN IF NOT EXISTS communication_intent text;
ALTER TABLE audit_global ADD COLUMN IF NOT EXISTS communication_intent text;
