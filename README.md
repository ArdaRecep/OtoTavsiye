# HangiAraç

HangiAraç; bütçe ve kullanım önceliklerine göre açıklanabilir araç önerileri sunan, araçları karşılaştıran ve kullanıcıların anonim bir kullanıcı adıyla deneyim paylaşabildiği Next.js uygulamasıdır.

## Ürün alanları

- Fiyat, gövde, yakıt, şanzıman ve kullanım önceliklerine göre öneri
- Filtresiz katalog gezintisi, bağımsız araç araması ve kademeli yükleme
- Araç detayları, puanlama, favoriler ve en fazla dört araçlık karşılaştırma
- Nested araç yorumları, yorum reaksiyonları ve bildirimler
- Araç tavsiyesi, sahip deneyimi, teknik soru ve genel sohbet kategorili topluluk
- Kullanıcı adı ve şifreyle hızlı, e-posta istemeyen kullanıcı deneyimi
- Blog, araç kataloğu, yorum, kullanıcı banı ve yasaklı kelime yönetimi
- Ortam değişkeniyle etkinleşen sponsor alanları
- Dinamik sitemap, robots ve sosyal paylaşım metadata bilgileri

## Kurulum

```bash
npm install
cp .env.example .env
npm run dev
```

Uygulama varsayılan olarak [http://localhost:3000](http://localhost:3000) adresinde açılır.

## Supabase

`.env` içinde aşağıdaki bağlantı bilgileri bulunmalıdır:

```text
PROJECT_ID=
ANON_PUBLIC=
SERVICE_ROLE_SECRET=
```

Alternatif olarak standart `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` ve `SUPABASE_SERVICE_ROLE_KEY` isimleri de desteklenir. Servis rolü anahtarı yalnızca sunucu tarafında kullanılır ve `NEXT_PUBLIC_` önekiyle tanımlanmamalıdır.

Yeni topluluk alanını etkinleştirmek için Supabase SQL Editor'da şu migrationı çalıştır:

```text
migrations/20260717_add_community_hub.sql
migrations/20260717_fix_community_comment_creation.sql
migrations/20260717_add_community_media.sql
migrations/20260717_add_community_thread_reactions.sql
migrations/20260717_harden_admin_bans.sql
```

Diğer migrationlar tarih sırasıyla `migrations/` klasöründedir. Yalnızca henüz uygulanmayan migrationları sırayla çalıştır; üretim veritabanında önce yedek almak önerilir. Topluluk konu görselleri `community-images` adlı public Storage bucket'ında tutulur; konu başına 3 görsel, dosya başına 2 MB sınırı vardır. Yorumlara dosya yüklenmez.

## Öneri mimarisi

`/api/recommendations` kullanıcı isteğini doğrular. Öncelik veya araç filtresi seçildiyse yalnızca Supabase `arac_oner` RPC fonksiyonunu çağırır ve en iyi 10 sonucu döndürür. Sadece fiyat aralığı varsa veya hiç tercih seçilmediyse katalog sayfalı olarak listelenir. Arama, aktif öneri listesinden bağımsız biçimde tüm araç kataloğunda çalışır.

Karmaşık skor ve aggregate işlemleri PostgreSQL fonksiyonlarında tutulur. İstemci kodunda raw SQL bulunmaz.

## Sponsor alanları

Sponsor alanları varsayılan olarak görünmez. Aşağıdaki değerler tanımlandığında öneri ve topluluk sayfalarında otomatik açılır:

```text
NEXT_PUBLIC_SPONSOR_NAME=
NEXT_PUBLIC_SPONSOR_URL=
NEXT_PUBLIC_SPONSOR_MESSAGE=
NEXT_PUBLIC_SPONSOR_IMAGE_URL=
```

Arama motoru URL'leri ve canonical metadata için üretimde `NEXT_PUBLIC_SITE_URL` tanımlanmalıdır.

## Kontroller

```bash
npm run typecheck
npm run lint
npm run build
```

Üç kontrolü sırayla çalıştırmak için:

```bash
npm run check
```

## Vercel

1. Repoyu Vercel projesine bağla.
2. `.env` değişkenlerini Vercel Project Settings altında tanımla.
3. Build komutunu `npm run build` olarak bırak.
4. `NEXT_PUBLIC_SITE_URL` değerini üretim alan adına ayarla.
5. Deploy sonrasında `/sitemap.xml`, `/robots.txt`, anonim kayıt, öneri, yorum ve admin akışlarını kontrol et.
