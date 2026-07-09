-- ==========================================
-- KULLANICI (USER) VE ETKİLEŞİM SİSTEMİ TABLOLARI
-- Supabase SQL Editor'de çalıştırılacak
-- ==========================================

-- 1. KULLANICILAR (USERS) TABLOSU
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    username VARCHAR(50) NOT NULL,
    avatar_url TEXT, -- Kullanıcı PP (Profil Resmi) URL'si
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. KULLANICI & ARAÇ ETKİLEŞİMLERİ (Birleştirilmiş Tablo)
-- Like ve Favorite işlemleri aynı tabloda bağımsız şalterler olarak tutulur.
CREATE TABLE user_vehicle_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id VARCHAR(50) NOT NULL REFERENCES vehicle_market_profiles(id) ON DELETE CASCADE,
    is_liked BOOLEAN DEFAULT false,
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, vehicle_id) -- Her kullanıcı-araç eşleşmesi için tek satır
);

CREATE INDEX idx_interactions_user ON user_vehicle_interactions(user_id);
CREATE INDEX idx_interactions_vehicle ON user_vehicle_interactions(vehicle_id);
CREATE UNIQUE INDEX idx_users_username_lower ON users (LOWER(username));

-- 3. YORUMLAR VE YANITLAR (COMMENTS) TABLOSU
CREATE TABLE vehicle_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id VARCHAR(50) NOT NULL REFERENCES vehicle_market_profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES vehicle_comments(id) ON DELETE CASCADE, -- Yanıtlar için, null ise kök yorumdur
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_vehicle ON vehicle_comments(vehicle_id);
CREATE INDEX idx_comments_user ON vehicle_comments(user_id);
CREATE INDEX idx_comments_parent ON vehicle_comments(parent_id);

-- Updated_at tetikleyicisi (Otomatik güncelleme)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_modtime
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_interactions_modtime
    BEFORE UPDATE ON user_vehicle_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_vehicle_comments_modtime
    BEFORE UPDATE ON vehicle_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
