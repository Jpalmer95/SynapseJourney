-- Rollback: Remove Qwen3-TTS mode columns from user_profiles

ALTER TABLE user_profiles
  DROP COLUMN IF EXISTS tts_qwen_mode,
  DROP COLUMN IF EXISTS tts_qwen_style_instruction,
  DROP COLUMN IF EXISTS tts_qwen_voice_description,
  DROP COLUMN IF EXISTS tts_ref_text;
