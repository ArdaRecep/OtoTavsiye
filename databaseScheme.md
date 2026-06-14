-- 1. Eski tablo ve fonksiyonları temizle
DROP FUNCTION IF EXISTS arac_oner;
DROP TABLE IF EXISTS vehicle_market_profiles;

-- ==========================================
-- 2. TABLO OLUŞTURMA
-- ==========================================
CREATE TABLE vehicle_market_profiles (
    id                  VARCHAR(50)  PRIMARY KEY, 
    make                VARCHAR(50)  NOT NULL,    
    model               VARCHAR(50)  NOT NULL,    
    trim_level          VARCHAR(100) NOT NULL,    -- DÜZELTİLDİ: trim -> trim_level
    segment             VARCHAR(30)  NOT NULL,    
    
    -- Filtreleme Kolonları
    body_type           VARCHAR(30)  NOT NULL CHECK (body_type IN ('Hatchback','Sedan','Crossover','SUV')),
    fuel_type           VARCHAR(30)  NOT NULL CHECK (fuel_type IN ('Benzin','Dizel','Hibrit','Elektrik')),
    transmission        VARCHAR(30)  NOT NULL CHECK (transmission IN ('Manuel','Otomatik')),
    min_seats           INT NOT NULL DEFAULT 5,
    power_hp            INT NOT NULL,             
    
    -- Piyasa Projeksiyonu ve Kondisyon
    min_year            INT NOT NULL,             
    max_year            INT NOT NULL,             
    min_km              INT NOT NULL,             
    max_km              INT NOT NULL,             
    market_min_price    NUMERIC(12,2) NOT NULL,   
    market_max_price    NUMERIC(12,2) NOT NULL,   
    avg_annual_cost_try NUMERIC(12,2) NOT NULL,   
    condition_summary   TEXT NOT NULL,            
    
    -- Görsel ve Metinsel Detaylar
    image_url           TEXT,
    tags                TEXT[] NOT NULL DEFAULT '{}', 
    why_listed          TEXT[] NOT NULL DEFAULT '{}', 
    pros                TEXT[] NOT NULL DEFAULT '{}', 
    cons                TEXT[] NOT NULL DEFAULT '{}', 

    -- Algoritma Skorları (0 - 10 Arası)
    safety_score        NUMERIC(3,1) NOT NULL CHECK (safety_score BETWEEN 0 AND 10),
    efficiency_score    NUMERIC(3,1) NOT NULL CHECK (efficiency_score BETWEEN 0 AND 10),
    family_score        NUMERIC(3,1) NOT NULL CHECK (family_score BETWEEN 0 AND 10),
    comfort_score       NUMERIC(3,1) NOT NULL CHECK (comfort_score BETWEEN 0 AND 10),
    performance_score   NUMERIC(3,1) NOT NULL CHECK (performance_score BETWEEN 0 AND 10),
    youth_score         NUMERIC(3,1) NOT NULL CHECK (youth_score BETWEEN 0 AND 10),
    resale_score        NUMERIC(3,1) NOT NULL CHECK (resale_score BETWEEN 0 AND 10),
    city_score          NUMERIC(3,1) NOT NULL CHECK (city_score BETWEEN 0 AND 10),   
    long_trip_score     NUMERIC(3,1) NOT NULL CHECK (long_trip_score BETWEEN 0 AND 10),
    maintenance_score   NUMERIC(3,1) NOT NULL CHECK (maintenance_score BETWEEN 0 AND 10),
    tech_score          NUMERIC(3,1) NOT NULL CHECK (tech_score BETWEEN 0 AND 10),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 3. PERFORMANS İNDEKSLERİ
-- ==========================================
CREATE INDEX idx_market_profiles_min_price ON vehicle_market_profiles (market_min_price);
CREATE INDEX idx_market_profiles_max_price ON vehicle_market_profiles (market_max_price);
CREATE INDEX idx_market_profiles_filters ON vehicle_market_profiles (body_type, fuel_type, transmission, min_seats);

-- ==========================================
-- 4. AKILLI ÖNERİ FONKSİYONU
-- ==========================================
CREATE OR REPLACE FUNCTION arac_oner(
    -- Zorunlu Bütçe Parametreleri
    p_min_budget NUMERIC,
    p_max_budget NUMERIC,
    
    -- Opsiyonel Filtreler 
    p_body_type VARCHAR DEFAULT NULL,
    p_fuel_type VARCHAR DEFAULT NULL,
    p_transmission VARCHAR DEFAULT NULL,
    p_min_seats INT DEFAULT NULL,
    
    -- Öncelik Ağırlıkları 
    w_safety NUMERIC DEFAULT 0,
    w_efficiency NUMERIC DEFAULT 0,
    w_family NUMERIC DEFAULT 0,
    w_comfort NUMERIC DEFAULT 0,
    w_performance NUMERIC DEFAULT 0,
    w_youth NUMERIC DEFAULT 0,
    w_resale NUMERIC DEFAULT 0,
    w_city NUMERIC DEFAULT 0,
    w_long_trip NUMERIC DEFAULT 0,
    w_maintenance NUMERIC DEFAULT 0,
    w_tech NUMERIC DEFAULT 0
)
RETURNS TABLE (
    id VARCHAR,
    make VARCHAR,
    model VARCHAR,
    trim_level VARCHAR, -- DÜZELTİLDİ: trim -> trim_level
    segment VARCHAR,
    power_hp INT,
    min_year INT,
    max_year INT,
    min_km INT,
    max_km INT,
    market_min_price NUMERIC,
    market_max_price NUMERIC,
    avg_annual_cost_try NUMERIC,
    condition_summary TEXT,
    image_url TEXT,
    tags TEXT[],
    why_listed TEXT[],
    pros TEXT[],
    cons TEXT[],
    match_score NUMERIC
) AS $$
DECLARE
    total_weight NUMERIC;
BEGIN
    -- Toplam ağırlığı hesapla
    total_weight := w_safety + w_efficiency + w_family + w_comfort + w_performance + 
                    w_youth + w_resale + w_city + w_long_trip + w_maintenance + w_tech;
                    
    -- Eğer kullanıcı hiçbir öncelik seçmediyse (Genel Ortalama Modu)
    IF total_weight = 0 THEN 
        w_safety := 1; 
        w_efficiency := 1; 
        w_family := 1; 
        w_comfort := 1; 
        w_performance := 1; 
        w_youth := 1; 
        w_resale := 1; 
        w_city := 1; 
        w_long_trip := 1; 
        w_maintenance := 1; 
        w_tech := 1;
        
        total_weight := 11; 
    END IF;

    RETURN QUERY
    SELECT 
        v.id, v.make, v.model, v.trim_level, v.segment, v.power_hp, -- DÜZELTİLDİ: v.trim -> v.trim_level
        v.min_year, v.max_year, v.min_km, v.max_km, 
        v.market_min_price, v.market_max_price, v.avg_annual_cost_try, v.condition_summary,
        v.image_url, v.tags, v.why_listed, v.pros, v.cons,
        
        -- Ağırlıklı Puan Hesaplama
        ROUND(
            (
                (v.safety_score * w_safety) +
                (v.efficiency_score * w_efficiency) +
                (v.family_score * w_family) +
                (v.comfort_score * w_comfort) +
                (v.performance_score * w_performance) +
                (v.youth_score * w_youth) +
                (v.resale_score * w_resale) +
                (v.city_score * w_city) +
                (v.long_trip_score * w_long_trip) +
                (v.maintenance_score * w_maintenance) +
                (v.tech_score * w_tech)
            ) / total_weight * 10, 1
        ) AS match_score
    FROM 
        vehicle_market_profiles v
    WHERE 
        -- Fiyat Kesişimi 
        v.market_min_price <= p_max_budget 
        AND v.market_max_price >= p_min_budget
        
        -- Kasa, Yakıt, Vites ve Koltuk Filtreleri
        AND (p_body_type IS NULL OR v.body_type = p_body_type)
        AND (p_fuel_type IS NULL OR v.fuel_type = p_fuel_type)
        AND (p_transmission IS NULL OR v.transmission = p_transmission)
        AND (p_min_seats IS NULL OR v.min_seats >= p_min_seats)
        
    -- En yüksek uyum sağlayandan en düşüğe sırala
    ORDER BY 
        match_score DESC;
END;
$$ LANGUAGE plpgsql;