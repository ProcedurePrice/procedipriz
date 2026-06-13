-- 012_compositions_adjustments.sql
-- Replace the scalar urgency_emergency boolean with a generic adjustments JSONB array.
-- Adjustments are additive CBHPM percentage codes (e.g. "emergency_special_hours").
-- Existing rows with urgency_emergency = true are migrated to the new column.

ALTER TABLE compositions
  ADD COLUMN IF NOT EXISTS adjustments JSONB NOT NULL DEFAULT '[]';

-- Migrate existing urgency/emergency rows.
UPDATE compositions
  SET adjustments = '["emergency_special_hours"]'
  WHERE urgency_emergency = TRUE;

ALTER TABLE compositions
  DROP COLUMN IF EXISTS urgency_emergency;
