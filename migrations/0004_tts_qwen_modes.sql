-- Migration: Add Qwen3-TTS mode columns to user_profiles
-- Adds support for three Qwen3-TTS synthesis modes:
--   - custom_voice: preset speakers with optional style instructions
--   - voice_design: text-described custom voice
--   - voice_clone: reference audio cloning with transcript

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS tts_qwen_mode TEXT DEFAULT 'custom_voice',
  ADD COLUMN IF NOT EXISTS tts_qwen_style_instruction TEXT,
  ADD COLUMN IF NOT EXISTS tts_qwen_voice_description TEXT,
  ADD COLUMN IF NOT EXISTS tts_ref_text TEXT;
