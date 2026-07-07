-- ==========================================
-- LIKE & YORUM SİSTEMİ TABLOLARI
-- Supabase SQL Editor'de çalıştırılacak
-- ==========================================

-- 1. LIKE TABLOSU
CREATE TABLE vehicle_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id VARCHAR(50) NOT NULL REFERENCES vehicle_market_profiles(id) ON DELETE CASCADE,
    user_fingerprint VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(vehicle_id, user_fingerprint)
);

CREATE INDEX idx_likes_vehicle ON vehicle_likes(vehicle_id);
CREATE INDEX idx_likes_fingerprint ON vehicle_likes(user_fingerprint);

-- 2. YORUM TABLOSU
CREATE TABLE vehicle_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id VARCHAR(50) NOT NULL REFERENCES vehicle_market_profiles(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES vehicle_comments(id) ON DELETE CASCADE,
    user_fingerprint VARCHAR(64) NOT NULL,
    user_name VARCHAR(50) NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_vehicle ON vehicle_comments(vehicle_id);
CREATE INDEX idx_comments_parent ON vehicle_comments(parent_id);
