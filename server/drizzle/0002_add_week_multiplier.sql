-- Migration: Add scoring multiplier to weeks table
-- Allows configurable point multiplier per week (default 1, no change)
-- Useful for special events, themed competitions, or playoff weeks
-- 
-- This migration adds support for per-week scoring multipliers in production databases.
-- The multiplier column is also defined in the Drizzle schema, so new databases get it 
-- automatically. This migration ensures existing production databases (created before this change)
-- can be upgraded to support the feature.

ALTER TABLE week ADD COLUMN multiplier INTEGER DEFAULT 1 NOT NULL;

