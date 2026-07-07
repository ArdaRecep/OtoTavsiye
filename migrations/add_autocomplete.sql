-- 1. Trigram eklentisini aktif et (Eğer yoksa)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Arama performansını artırmak için GIN Indeksi oluştur.
CREATE INDEX IF NOT EXISTS idx_vmp_search_trgm 
ON vehicle_market_profiles 
USING GIN ((make || ' ' || model || ' ' || trim_level || ' ' || fuel_type) gin_trgm_ops);

-- 3. Arama Fonksiyonu (RPC)
CREATE OR REPLACE FUNCTION search_vehicles_autocomplete(search_query text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
BEGIN
    WITH matches AS (
        -- Eşleşen satırları getir (Performans için LIMIT koyuyoruz)
        SELECT make, model, trim_level, fuel_type
        FROM vehicle_market_profiles
        WHERE (make || ' ' || model || ' ' || trim_level || ' ' || fuel_type) ILIKE '%' || search_query || '%'
        LIMIT 30
    ),
    suggestion_list AS (
        -- Metin tamamlamaları: Sadece benzersiz Marka + Model + Paket kombinasyonları
        SELECT DISTINCT make || ' ' || model || ' ' || trim_level AS suggestion
        FROM matches
        LIMIT 5
    ),
    category_list AS (
        -- Kategori hiyerarşisi (Vasıta > Otomobil > Marka > Model)
        SELECT DISTINCT 'Vasıta > Otomobil > ' || make || ' > ' || model AS category_path
        FROM matches
        LIMIT 4
    )
    SELECT json_build_object(
        'suggestions', COALESCE((SELECT json_agg(suggestion) FROM suggestion_list), '[]'::json),
        'categories', COALESCE((SELECT json_agg(category_path) FROM category_list), '[]'::json)
    ) INTO result;

    RETURN result;
END;
$$;
