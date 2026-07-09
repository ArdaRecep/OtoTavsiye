# Supabase Auth Migration Setup

Varsayim: proje gelistirme asamasindadir; eski local-auth test kullanicilari korunmak zorunda degildir.

## Migration sirasi

1. Mevcut temel tablo migration'lari (`databaseScheme*.sql`, `migrations/add_*.sql`, `migrations/20260708_social_ratings_comments.sql`) uygulanmis olmali.
2. `migrations/20260708_supabase_auth_profiles.sql`

Rollback gerekirse:

1. `migrations/20260708_supabase_auth_profiles_rollback.sql`

## Supabase Dashboard

1. Authentication > Providers > Email provider aktif olmali.
2. Email confirmation politikasini urun kararina gore ayarla. Gelistirme icin confirmation kapali olursa kayit sonrasi session hemen acilir.
3. Site URL ve redirect URL degerlerini uygulama domainine gore ayarla.
4. Service role key sadece server ortaminda tanimli olmali.

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Mevcut `PROJECT_ID`, `ANON_PUBLIC`, `PUBLISHABLE_KEY`, `SERVICE_ROLE_SECRET` fallback olarak desteklenir.
`SUPABASE_SERVICE_ROLE_KEY` client tarafinda kullanilmaz; sadece Route Handler/server helper icinden okunur.

## Mevcut test kullanicilari

Bu migration development varsayimi ile hazirlandi. Eski local-auth kullanicilari ve onlara bagli test yorum/favori/puan kayitlari temizlenir; yeni kullanicilar Supabase Authentication > Users altinda yeniden olusturulur.

## Auth notlari

- Parola artik `public.users` tablosunda tutulmaz.
- `public.users.id`, `auth.users.id` ile ayni UUID degeridir.
- Kullanici kimligi server tarafinda Supabase Auth session cookie uzerinden okunur.
- Client tarafindan gelen `userId`, `x-user-id` veya localStorage kimligi authorization kaynagi degildir.
- Eski sosyal RPC yardimcisi `public.current_app_user_id()` bu migration ile yeniden yazilir ve sadece `auth.uid()` kullanir.
- `public.users` public select yetkisi yalnizca `id`, `username`, `avatar_url` kolonlari icindir. Oturum sahibinin tam profili server tarafinda service-role client ile okunur.

## Karsilastirma tablolari

Bu migration auth gecisiyle birlikte ileride kullanilacak karsilastirma semasini da hazirlar:

- `vehicle_comparisons`
- `vehicle_comparison_items`
- `vehicle_comparison_comments`
- `vehicle_comparison_generation_jobs`
- `vehicle_comparison_ai_reviews`

`vehicle_comparison_ai_reviews` DeepSeek tarafindan uretilecek gorunur ozet/yorum/result JSON icindir. Chain-of-thought veya reasoning icerigi saklanmamalidir.

Karsilastirma tablolari zaten olustuysa, veri silmeden sadece eksik tablolari eklemek icin:

1. `migrations/20260708_add_vehicle_comparison_tables.sql`

Backend RPC ve API route'lari icin ek fonksiyonlar:

1. `migrations/20260709_add_vehicle_comparison_functions.sql`

Bu ikinci dosya `ensure_vehicle_comparison`, detail/comment RPC'leri ve generation job claim/complete/fail fonksiyonlarini ekler.
