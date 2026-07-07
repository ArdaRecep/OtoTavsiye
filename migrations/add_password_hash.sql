-- ==========================================
-- USERS TABLOSUNA ŞİFRE KOLONU EKLEMESİ
-- Supabase SQL Editor'de çalıştırılacak
-- ==========================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(64);
