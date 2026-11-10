CREATE TABLE IF NOT EXISTS "AdminAssistantSpend" (
  "month" text PRIMARY KEY,
  "nanoUsd" bigint NOT NULL CHECK ("nanoUsd" >= 0)
);
