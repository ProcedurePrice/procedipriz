-- v2.5.0: add urgency_emergency to compositions
-- CBHPM 2022 General Instructions item 2 — 30% surcharge for acts performed
-- in urgency/emergency special hours (19h–7h, weekends, holidays).
-- Nullable default so existing rows read FALSE without a full-table update.
ALTER TABLE compositions
  ADD COLUMN IF NOT EXISTS urgency_emergency BOOLEAN NOT NULL DEFAULT false;
