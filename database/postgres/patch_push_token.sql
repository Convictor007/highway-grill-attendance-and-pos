-- Add push_token column to users for Expo push notifications
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
