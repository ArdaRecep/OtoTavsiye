Bir Next.js ve Supabase/PostgreSQL projesinde profesyonel seviyede, otomatik çalışan bir “araç karşılaştırma ve tavsiye sistemi” geliştireceksin.

Bu görev yalnızca bir plan hazırlama görevi değildir. Mevcut repository’yi inceleyerek gerekli SQL migration dosyalarını, Supabase Edge Function kodlarını, Next.js backend katmanını, frontend hook ve component yapılarını, validasyonları ve testleri uygulanabilir şekilde oluştur.

# 1. Önce repository analizi yap

Kod yazmadan önce aşağıdakileri incele:

* Kullanılan Next.js sürümü ve App Router yapısı
* TypeScript yapılandırması
* Mevcut Supabase client dosyaları
* Auth sistemi
* Araçların tutulduğu gerçek tablo adı
* Araç tablosunun primary key tipi
* Araçların marka, model, yıl, fiyat, motor, yakıt, şanzıman, tüketim, performans ve donanım alanları
* Mevcut kullanıcı veya profiles tablosu
* Mevcut öneriler sayfası
* Araç seçim state yapısı
* Mevcut karşılaştırma sayfası
* Oluşturulmuş Supabase TypeScript tipleri
* Kullanılan state ve data-fetching kütüphaneleri

Araç tablosunun adını veya kolonlarını tahmin etme. Repository’deki gerçek şemaya uyum sağla.

Mevcut yapı bilinmiyorsa tüm araç verisi erişimini tek bir adapter fonksiyonunda izole et:

`buildVehicleComparisonSnapshot(vehicleIds)`

Böylece araç tablosu değiştiğinde yalnızca bu adapter değiştirilmelidir.

# 2. Temel işlev

Kullanıcı öneriler sayfasında en fazla üç araç seçebilecek.

Kullanıcıya “karşılaştırmayı oluştur” butonu gösterilmeyecek.

Seçili benzersiz araç sayısı 2 veya 3 olduğunda sistem otomatik çalışacak.

Örnek:

* Kullanıcı Fiat Egea ve Renault Clio seçti.
* Kullanıcı hâlâ öneriler sayfasında olabilir.
* Frontend araç seçimindeki değişikliği algılamalıdır.
* Yaklaşık 500 ms debounce sonrasında karşılaştırmayı otomatik olarak ensure etmelidir.
* Bu kombinasyon daha önce oluşturulmuşsa mevcut karşılaştırma kullanılmalıdır.
* Daha önce oluşturulmamışsa veritabanı kaydı oluşturulmalı ve DeepSeek üretimi otomatik başlatılmalıdır.
* Kullanıcı butona basmamalıdır.
* Kullanıcı karşılaştırma sayfasına geçtiğinde sonuç hazırsa gösterilmeli, hazırlanıyorsa canlı durum gösterilmelidir.

İki araçlı ve üç araçlı kombinasyonlar birbirinden farklıdır:

* `[A, B]` bir karşılaştırmadır.
* `[A, B, C]` başka bir karşılaştırmadır.

Araçların seçilme sırası kombinasyonu değiştirmemelidir:

* `[A, B]`
* `[B, A]`

Bu iki seçim aynı karşılaştırmayı göstermelidir.

# 3. Değiştirilemez teknik kurallar

* Next.js uygulama kodunda raw SQL kullanma.
* Runtime veritabanı işlemlerini yalnızca Supabase JavaScript SDK ile gerçekleştir.
* Karmaşık ve atomik işlemlerde Supabase `.rpc()` kullan.
* Tüm SQL kodlarını migration dosyalarında eksiksiz üret.
* SQL kodlarını Supabase SQL Editor üzerinden çalıştırılabilir şekilde hazırla.
* SQL dosyalarında yarım kod, sözde kod veya “burayı doldurun” bırakma.
* DeepSeek API anahtarını hiçbir Client Component içinde kullanma.
* Supabase Service Role anahtarını hiçbir `NEXT_PUBLIC_` değişkeninde kullanma.
* DeepSeek çağrısını PostgreSQL fonksiyonu içinde yapma.
* DeepSeek çağrısını Supabase Edge Function veya güvenli sunucu worker katmanında yap.
* İstemciden gelen `user_id`, `status`, `ai_result`, `model` gibi güvenlik açısından önemli alanlara güvenme.
* Kullanıcı kimliğini sunucu tarafında Supabase Auth oturumundan al.
* TypeScript strict mode ile uyumlu kod yaz.
* `any` kullanma.
* Hataları yutma.
* Kullanıcıya dahili SQL, DeepSeek veya stack trace hatalarını gösterme.
* API anahtarlarını ve araç verisinin tamamını loglama.
* Mevcut proje yapısını gereksiz yere değiştirme.
* İlgisiz dosyalara dokunma.

# 4. Veritabanı tasarımı

Tek bir tabloda `araclar`, `yorumlar` ve `deepseek` kolonları oluşturma.

Aşağıdaki normalize edilmiş yapıyı oluştur.

## 4.1 `vehicle_comparisons`

Aşağıdaki alanları gerçek proje tiplerine uyarlayarak oluştur:

* `id`
* `combination_key`
* `vehicle_count`
* `status`
* `ai_result jsonb`
* `ai_summary text`
* `ai_recommendation text`
* `ai_model text`
* `prompt_version text`
* `source_hash text`
* `requested_by`
* `generation_attempts`
* `generation_started_at`
* `generated_at`
* `last_error`
* `created_at`
* `updated_at`

Kurallar:

* `combination_key` unique olmalıdır.
* `vehicle_count` yalnızca 2 veya 3 olabilir.
* `status` yalnızca belirlenmiş durum değerlerinden biri olabilir.
* Yeni kaydın varsayılan durumu `pending` olmalıdır.
* `last_error` sınırlı uzunlukta tutulmalıdır.
* `ai_result` yalnızca doğrulanmış final JSON içermelidir.
* DeepSeek’in chain-of-thought veya reasoning içeriğini saklama.

Durum değerleri:

* `pending`
* `generating`
* `ready`
* `failed`
* `stale`
* `disabled`

PostgreSQL enum yerine genişletilmesi daha kolay olan text + check constraint kullan.

## 4.2 `vehicle_comparison_items`

Alanlar:

* `comparison_id`
* `vehicle_id`
* `canonical_position`
* `created_at`

Kurallar:

* Araç tablosuna foreign key oluştur.
* Karşılaştırma silinirse ilişkileri cascade sil.
* Primary key veya unique constraint ile aynı araç aynı karşılaştırmaya iki kere eklenemesin.
* `canonical_position` yalnızca 1, 2 veya 3 olabilir.
* `comparison_id, canonical_position` unique olmalıdır.
* Araçlar canonical olarak sıralanmış biçimde saklanmalıdır.

## 4.3 `vehicle_comparison_comments`

Alanlar:

* `id`
* `comparison_id`
* `user_id`
* `parent_id`
* `root_id`
* `depth`
* `body`
* `created_at`
* `updated_at`
* `deleted_at`

Kurallar:

* Yorumlar ayrı satırlar halinde tutulmalıdır.
* Bir yanıtın `parent_id` değeri başka bir karşılaştırmadaki yorumu gösterememelidir.
* Bunun için mümkünse composite foreign key kullan.
* `root_id`, yorum ağacının en üst yorumunu göstermelidir.
* Üst yorumlarda `root_id`, yorumun kendi kimliği olmalıdır.
* Maksimum yanıt derinliği 10 olmalıdır.
* Yorum metni trim edilmelidir.
* Boş yorum engellenmelidir.
* Maksimum yorum uzunluğu 5000 karakter olmalıdır.
* Silme işlemi varsayılan olarak soft delete olmalıdır.
* Silinen üst yorumun yanıtları silinmemelidir.
* Silinmiş yorum kullanıcıya `[silindi]` olarak gösterilebilmelidir.

## 4.4 `vehicle_comparison_generation_jobs`

Alanlar:

* `id`
* `comparison_id`
* `status`
* `attempt_count`
* `available_at`
* `locked_at`
* `completed_at`
* `last_error`
* `created_at`
* `updated_at`

Kurallar:

* Her karşılaştırma için yalnızca bir aktif üretim işi bulunmalıdır.
* `comparison_id` unique olmalıdır.
* Job durumları `queued`, `processing`, `completed`, `failed` olabilir.
* Aynı job iki worker tarafından aynı anda alınamamalıdır.
* Claim işlemi tek bir atomik UPDATE veya uygun PostgreSQL kilitleme mekanizmasıyla yapılmalıdır.
* Başarısız işler belirlenmiş deneme sayısına kadar yeniden denenebilmelidir.
* Eski `processing` işleri belirli süre sonra tekrar alınabilmelidir.

# 5. Kombinasyon anahtarı

Karşılaştırma oluşturulurken:

1. Gelen araç kimliklerini doğrula.
2. Duplicate araç kimliklerini kaldır.
3. Araç sayısının 2 veya 3 olduğunu doğrula.
4. Araç kimliklerini canonical şekilde sırala.
5. Sıralanmış kimliklerden deterministik bir `combination_key` oluştur.

Araç primary key tipi UUID, bigint veya başka bir tip olabilir. Mevcut şemayı inceleyip uygun çözümü kullan.

Anahtar okunabilir ve deterministik olabilir:

`vehicleId1:vehicleId2:vehicleId3`

Unique constraint veritabanı seviyesinde bulunmalıdır.

Yalnızca frontend kontrolüne güvenme.

İki eşzamanlı istek aynı kombinasyonu oluşturmak isterse yalnızca tek karşılaştırma kaydı oluşmalıdır.

Bunun için `INSERT ... ON CONFLICT` mantığını SQL RPC fonksiyonu içinde uygula.

# 6. Oluşturulacak SQL fonksiyonları

Tüm fonksiyonları tam SQL koduyla oluştur.

Fonksiyon isimlerini overload etme.

Gerekli `REVOKE` ve `GRANT` komutlarını da ekle.

`security definer` gereken fonksiyonlarda:

* `set search_path = ''` kullan.
* Tüm tablo ve fonksiyon isimlerini schema adıyla çağır.
* `auth.uid()` kontrolü yap.
* Kullanıcı girdilerini doğrula.
* Fonksiyonların istemeden anon role açılmasını engelle.

## 6.1 `ensure_vehicle_comparison`

Parametre:

* Seçili araç kimlikleri dizisi

İşlem:

* Kullanıcı oturumunu kontrol et.
* Kimlikleri normalize et.
* Duplicate değerleri kaldır.
* 2–3 araç kontrolü yap.
* Araçların gerçekten var olduğunu doğrula.
* Kullanıma kapalı veya silinmiş araçlar varsa reddet.
* Canonical key oluştur.
* Karşılaştırma varsa mevcut kaydı döndür.
* Yoksa karşılaştırmayı oluştur.
* Araç ilişkilerini aynı transaction içinde ekle.
* Generation job oluştur veya mevcut job’ı uygun şekilde ensure et.
* `created_new` boolean alanı döndür.
* Karşılaştırma kimliği, durum, mevcut AI sonucu ve zaman bilgilerini döndür.

Fonksiyon idempotent olmalıdır.

## 6.2 `get_vehicle_comparison_detail`

Parametre:

* `comparison_id`

Döndürülecek bilgiler:

* Karşılaştırma
* Durum
* AI sonucu
* Araçların canonical listesi
* Araçların ekranda gösterilecek temel bilgileri
* Oluşturulma zamanı
* Son güncelleme zamanı
* Hata durumunda kullanıcıya gösterilebilecek güvenli hata tipi

Yetkisiz veya bulunamayan kayıt için kontrollü sonuç döndür.

## 6.3 `claim_vehicle_comparison_generation`

Yalnızca Service Role veya güvenli worker tarafından çağrılabilmelidir.

İşlem:

* Job durumunu atomik olarak `processing` yap.
* İlgili karşılaştırmayı `generating` yap.
* `locked_at` ve `generation_started_at` alanlarını güncelle.
* `attempt_count` ve `generation_attempts` değerlerini artır.
* Başka worker claim etmişse `false` döndür.
* Belirli süreden eski kilitleri stale kabul et.
* Claim başarılıysa gerekli job ve comparison bilgilerini döndür.

## 6.4 `complete_vehicle_comparison_generation`

Yalnızca güvenli worker tarafından çağrılmalıdır.

Parametreler:

* comparison id
* doğrulanmış AI JSON sonucu
* kısa özet
* tavsiye metni
* model adı
* prompt sürümü
* source hash

İşlem:

* Karşılaştırmayı `ready` yap.
* AI alanlarını güncelle.
* `generated_at` alanını doldur.
* Eski hata bilgisini temizle.
* Job durumunu `completed` yap.
* İşlemi transaction içinde tamamla.

## 6.5 `fail_vehicle_comparison_generation`

Yalnızca güvenli worker tarafından çağrılmalıdır.

İşlem:

* Güvenli ve sınırlı hata mesajını kaydet.
* Attempt sayısına göre job’ı tekrar `queued` veya kalıcı `failed` yap.
* Gecikmeli retry için `available_at` hesapla.
* Karşılaştırmayı uygun şekilde `pending` veya `failed` yap.
* API key, request header veya tam stack trace kaydetme.

Retry gecikmesi örneği:

* 1. hata: 10 saniye
* 2. hata: 30 saniye
* 3. hata: 2 dakika
* Sonrasında kalıcı failed

## 6.6 `requeue_stale_vehicle_comparison`

Aşağıdaki durumlarda yeniden üretim sağlayabilmelidir:

* Araç bilgilerinin source hash değeri değişti.
* Prompt sürümü değişti.
* Model yapılandırması değişti.
* Generation işlemi uzun süre `generating` kaldı.
* Önceki işlem geçici hata nedeniyle başarısız oldu.

## 6.7 Yorum fonksiyonları

Aşağıdaki fonksiyonları oluştur:

* `create_vehicle_comparison_comment`
* `update_vehicle_comparison_comment`
* `delete_vehicle_comparison_comment`
* `get_vehicle_comparison_comment_threads`

Yorum oluştururken:

* `user_id` parametre olarak istemciden alma.
* `auth.uid()` kullan.
* Parent yorumun aynı karşılaştırmaya ait olduğunu doğrula.
* Parent yorum silinmiş olsa bile yanıt politikasını açıkça belirle.
* Maksimum derinliği kontrol et.
* `root_id` ve `depth` değerlerini sunucu tarafında hesapla.

Yorum güncellerken:

* Yalnızca yorum sahibi veya mevcut projedeki admin rolü güncelleyebilsin.
* Silinmiş yorum güncellenemesin.

Yorum silerken:

* Yalnızca sahibi veya admin silebilsin.
* Soft delete uygula.
* Body içeriğini temizle veya kullanıcıya gönderilmeyecek şekilde koru.
* Yanıtları silme.

Yorumları getirirken:

* Üst yorumlar sayfalanabilsin.
* Bir üst yorum getirildiğinde alt yanıtları da ağaç bilgileriyle getir.
* Sonucu frontend’in kolayca ağaç yapısına çevirebileceği typed formatta döndür.
* Sonsuz recursive sorguya karşı depth limiti uygula.
* Stable pagination kullan.
* Offset pagination yerine cursor pagination tercih et.

# 7. Trigger ve indexler

Aşağıdakileri oluştur:

* Genel `updated_at` trigger fonksiyonu
* İlgili tüm tablolarda updated_at trigger’ları
* Karşılaştırma kombinasyonu için unique index
* `vehicle_comparison_items.vehicle_id` indexi
* Comment `comparison_id` indexi
* Comment `parent_id` indexi
* Comment `root_id` indexi
* Comment `user_id` indexi
* Comment thread sıralama indexi
* Job status ve `available_at` indexi
* Pending/generating kayıtlar için gerekli partial indexler

Indexleri sorgulara göre gerekçelendir.

Gereksiz index oluşturma.

# 8. RLS ve yetkilendirme

Public schema içindeki bütün yeni tablolarda RLS etkinleştir.

Varsayılan davranış:

* Oturum açmış kullanıcılar hazır karşılaştırmaları okuyabilir.
* Oturum açmış kullanıcılar karşılaştırma yorumlarını okuyabilir.
* Kullanıcılar yalnızca kendi yorumlarını oluşturabilir, güncelleyebilir ve soft delete edebilir.
* Kullanıcılar AI sonucu, comparison status veya generation job alanlarını doğrudan değiştiremez.
* Client tarafından generation job tablolarına doğrudan insert/update/delete yapılamaz.
* Service Role worker işlemlerini gerçekleştirebilir.
* Anon erişimini mevcut projenin ürün kararına göre incele.
* Mevcut uygulama anonim karşılaştırma desteklemiyorsa anon role izin verme.

RPC fonksiyonlarının execute yetkilerini açıkça tanımla.

`public` role üzerindeki varsayılan execute izinlerini kaldır.

# 9. Realtime

Aşağıdaki tabloları gerekli Realtime publication’a ekle:

* `vehicle_comparisons`
* `vehicle_comparison_comments`

Frontend yalnızca ilgili kayıtları dinlemelidir.

Karşılaştırma subscription filtresi:

* `id = comparisonId`

Yorum subscription filtresi:

* `comparison_id = comparisonId`

Component unmount olduğunda channel subscription temizlenmelidir.

Aynı event tekrar gelirse duplicate yorum oluşturmamak için id tabanlı merge uygula.

INSERT, UPDATE ve DELETE/soft-delete eventlerini işle.

# 10. Database Webhook ve Edge Function

Yeni oluşturulan veya yeniden kuyruğa alınan generation job için Supabase Database Webhook kullan.

Edge Function adı:

`generate-vehicle-comparison`

Webhook güvenliği:

* Paylaşılan secret header veya güvenli Supabase function authentication kullan.
* Request body içindeki comparison id değerine körü körüne güvenme.
* Veritabanından job ve comparison durumunu yeniden doğrula.
* Claim RPC başarılı değilse üretim yapmadan 200 veya 409 benzeri kontrollü cevap dön.
* Aynı webhook birden fazla kez çalışırsa ikinci DeepSeek çağrısı oluşmamalıdır.

Database Webhook SQL ile güvenli şekilde oluşturulabiliyorsa migration içinde oluştur.

Proje URL’si veya secret migration içine güvenli biçimde konulamıyorsa:

* SQL tarafını hazırla.
* Dashboard üzerinden yapılacak webhook ayarlarını ayrı ve eksiksiz olarak yaz.
* URL ve secret için açık placeholder kullan.
* Secret değerini source control’e yazma.

# 11. Edge Function işlemi

Edge Function aşağıdaki sırayla çalışmalıdır:

1. Webhook kimlik doğrulamasını yap.
2. Payload şemasını doğrula.
3. Job ve comparison id değerini al.
4. `claim_vehicle_comparison_generation` RPC fonksiyonunu çağır.
5. Claim başarısızsa hiçbir AI çağrısı yapmadan çık.
6. Karşılaştırmadaki araçları oku.
7. Araçları güvenli ve deterministik bir snapshot formatına dönüştür.
8. Snapshot’un stable hash değerini hesapla.
9. Aynı source hash ve prompt version için sonuç zaten hazırsa üretimi atla.
10. DeepSeek çağrısını yap.
11. Gelen JSON’u Zod veya eşdeğer runtime schema ile doğrula.
12. Geçerli sonucu complete RPC ile kaydet.
13. Hata oluşursa fail RPC çağır.
14. Kullanıcı verisini, API key’i ve tam araç datasını loglama.

DeepSeek isteği için timeout uygula.

Önerilen timeout:

* 25–30 saniye

Boş veya geçersiz JSON gelirse en fazla bir format düzeltme retry’ı yap.

Toplam generation retry mekanizması veritabanındaki attempt sistemiyle kontrol edilmelidir.

# 12. DeepSeek yapılandırması

Environment variables:

* `DEEPSEEK_API_KEY`
* `DEEPSEEK_MODEL`
* `COMPARISON_PROMPT_VERSION`
* `COMPARISON_WEBHOOK_SECRET`
* `SUPABASE_URL`
* `SUPABASE_SERVICE_ROLE_KEY`

Varsayılan model environment üzerinden yönetilsin.

Model adını kod içine birçok noktada hardcode etme.

DeepSeek sonucu aşağıdaki JSON sözleşmesine uymalıdır:

{
"headline": "Kısa karşılaştırma başlığı",
"summary": "Araçların temel farklarını açıklayan kısa metin",
"vehicles": [
{
"vehicleId": "araç kimliği",
"strengths": ["güçlü yön"],
"weaknesses": ["zayıf yön"],
"bestFor": ["uygun kullanıcı profili"]
}
],
"tradeoffs": [
"Araçlar arasındaki önemli tercih farkı"
],
"recommendation": {
"vehicleId": "önerilen araç kimliği veya null",
"reason": "Önerinin kısa gerekçesi",
"confidence": "low | medium | high"
},
"dataWarnings": [
"Eksik veya karşılaştırılamayan veri"
]
}

Kurallar:

* Kullanıcıya gösterilecek dil Türkçe olmalıdır.
* Metin gereksiz uzun olmamalıdır.
* Özet yaklaşık 120–250 kelime arasında olmalıdır.
* Verilmeyen araç özelliklerini uydurmamalıdır.
* Veri yetersizse bunu açıkça belirtmelidir.
* Fiyat, tüketim veya performans gibi alanlarda inputta olmayan kesin rakam üretmemelidir.
* Tek bir aracı her koşulda kazanan ilan etmemelidir.
* Tavsiyeyi kullanım senaryosuna göre vermelidir.
* Chain-of-thought isteme veya saklama.
* Yalnızca final JSON çıktısını işle.

DeepSeek system prompt ve user prompt kodlarını ayrı sabitlerde tut.

Prompt version değiştiğinde eski sonuçların stale kabul edilmesini sağlayacak yapı kur.

# 13. Source hash ve veri güncelliği

Araç karşılaştırması sonsuza kadar değişmez kabul edilmemelidir.

Karşılaştırmada kullanılan araç snapshot’unu deterministik şekilde oluştur.

Hash hesaplamadan önce:

* Object key sırasını normalize et.
* Kullanılmayacak alanları çıkar.
* Tarih veya rastgele değer ekleme.
* Aynı veri her zaman aynı hash’i üretmeli.

Aşağıdakilerden biri değişmişse mevcut sonuç stale kabul edilebilir:

* Araç fiyatı
* Araç motor bilgisi
* Yakıt tipi
* Şanzıman
* Tüketim
* Donanım
* Prompt version
* Kullanılan model politikası

Snapshot’un tamamını saklamanın veri boyutu ve gizlilik açısından uygunluğunu değerlendir.

En azından `source_hash` sakla.

# 14. Next.js Route Handler

Oluştur:

`POST /api/comparisons/ensure`

Request:

{
"vehicleIds": ["id1", "id2"]
}

Davranış:

* Oturumu doğrula.
* Zod ile request body doğrula.
* 2–3 unique araç kontrolü yap.
* `ensure_vehicle_comparison` RPC çağır.
* Karşılaştırma ready ise HTTP 200 dön.
* Pending veya generating ise HTTP 202 dön.
* Aynı istek tekrarlandığında yeni kayıt oluşturma.
* Safe typed response dön.
* Route Handler’ı public API endpoint gibi güvenli tasarla.

Response örneği:

{
"comparisonId": "...",
"status": "ready | pending | generating | failed | stale",
"createdNew": true,
"result": null
}

`createdNew` yalnızca bilgi amaçlıdır; güvenlik kararı için kullanılmamalıdır.

Ayrıca oluştur:

* `GET /api/comparisons/[comparisonId]`
* `GET /api/comparisons/[comparisonId]/comments`
* `POST /api/comparisons/[comparisonId]/comments`
* `PATCH /api/comparison-comments/[commentId]`
* `DELETE /api/comparison-comments/[commentId]`

Route Handler’larda raw SQL kullanma.

# 15. Otomatik frontend hook

Oluştur:

`useAutoComparison`

Girdiler:

* seçili araç kimlikleri
* feature enabled değeri

Davranış:

* 0 veya 1 araç seçiliyse API çağrısı yapma.
* 3’ten fazla araç seçilmesini engelle.
* Duplicate kimlikleri kaldır.
* Kimlikleri canonical şekilde sırala.
* Yaklaşık 500 ms debounce uygula.
* Aynı canonical kombinasyon için tekrar tekrar istek gönderme.
* Kombinasyon değiştiğinde önceki client request’i AbortController ile iptal et.
* Loading, pending, ready, failed durumlarını typed şekilde yönet.
* Kullanıcının araç seçimini engelleme.
* Kullanıcıya karşılaştırma oluşturma butonu gösterme.
* Kullanıcı hızlıca ikinci ve üçüncü aracı seçerse gereksiz iki araçlı AI üretimini mümkün olduğunca önle.
* API hatasında sınırsız retry yapma.
* Network hatasında kontrollü retry uygula.

Mevcut projede TanStack Query veya SWR varsa mevcut sistemi kullan.

Yeni bir data-fetching kütüphanesini gereksiz yere ekleme.

# 16. Karşılaştırma sayfası

Sayfa aşağıdaki durumları desteklemelidir:

## Pending

* Karşılaştırmanın hazırlandığını göster.
* Sayfayı bloklama.
* Realtime subscription başlat.

## Generating

* AI değerlendirmesinin oluşturulduğunu göster.
* Polling yerine öncelikle Realtime kullan.
* Realtime bağlantısı koparsa sınırlı fallback polling kullan.

## Ready

* Araçların teknik karşılaştırmasını göster.
* DeepSeek özetini göster.
* Tavsiyeyi göster.
* Güçlü ve zayıf yönleri göster.
* Eksik veri uyarılarını göster.
* Yorum sistemini göster.

## Failed

* Kullanıcıya dahili hata göstermeden genel hata mesajı göster.
* Arka plandaki retry durumunu takip et.
* Kullanıcıya manuel “AI üret” butonu verme.
* Gerekirse sayfa yeniden açıldığında ensure işlemi retry job oluşturabilsin.

# 17. Yorum ve yanıt arayüzü

Reddit benzeri iç içe yanıt yapısı oluştur.

Gerekli özellikler:

* Üst yorum yazma
* Yoruma yanıt verme
* Kullanıcının kendi yorumunu düzenlemesi
* Kullanıcının kendi yorumunu silmesi
* Silinen yorumun altında yanıtların görünmeye devam etmesi
* İç içe girintili görünüm
* Maksimum 10 seviye
* Mobil uyum
* Optimistic update
* Başarısız mutation durumunda rollback
* Realtime ile başka kullanıcı yorumlarının eklenmesi
* Duplicate Realtime eventlerini engelleme

Yorum HTML olarak render edilmemelidir.

Düz metin veya güvenli sanitize edilmiş format kullan.

XSS oluşturabilecek `dangerouslySetInnerHTML` kullanma.

# 18. Concurrency ve idempotency testleri

Aşağıdaki testleri oluştur:

1. `[A, B]` ve `[B, A]` aynı karşılaştırma kimliğini döndürür.
2. Aynı kombinasyona eşzamanlı 20 istek yalnızca bir comparison oluşturur.
3. Aynı job’ı yalnızca bir worker claim edebilir.
4. Duplicate webhook yalnızca bir DeepSeek çağrısına yol açar.
5. İki araçlı ve üç araçlı kombinasyonlar farklıdır.
6. Aynı araç iki kere gönderilirse validation hatası oluşur.
7. Bir araç bulunamıyorsa comparison oluşmaz.
8. Parent yorum farklı comparison’a aitse yanıt oluşturulmaz.
9. Kullanıcı başka kullanıcının yorumunu güncelleyemez.
10. Soft delete sonrasında alt yanıtlar korunur.
11. Geçersiz DeepSeek JSON’u ready olarak kaydedilmez.
12. Boş DeepSeek sonucu retry edilir.
13. Stale generation lock tekrar alınabilir.
14. Source hash değişince kayıt stale olur.
15. Prompt version değişince yeniden üretim yapılabilir.
16. Realtime eventleri duplicate comment oluşturmaz.

SQL fonksiyonları için mümkünse pgTAP testleri oluştur.

TypeScript tarafında projenin mevcut test sistemini kullan.

# 19. Dosya çıktıları

Aşağıdaki yapıya denk gelecek dosyalar üret:

* `supabase/migrations/<timestamp>_create_vehicle_comparison_tables.sql`
* `supabase/migrations/<timestamp>_create_vehicle_comparison_functions.sql`
* `supabase/migrations/<timestamp>_create_vehicle_comparison_rls.sql`
* `supabase/migrations/<timestamp>_configure_vehicle_comparison_realtime.sql`
* `supabase/functions/generate-vehicle-comparison/index.ts`
* `app/api/comparisons/ensure/route.ts`
* `app/api/comparisons/[comparisonId]/route.ts`
* `app/api/comparisons/[comparisonId]/comments/route.ts`
* `app/api/comparison-comments/[commentId]/route.ts`
* `hooks/use-auto-comparison.ts`
* `hooks/use-comparison-realtime.ts`
* `hooks/use-comparison-comments-realtime.ts`
* `lib/comparisons/types.ts`
* `lib/comparisons/schemas.ts`
* `lib/comparisons/vehicle-snapshot.ts`
* `lib/comparisons/deepseek.ts`
* gerekli component dosyaları
* gerekli test dosyaları
* `.env.example` güncellemesi
* setup dokümantasyonu
* rollback SQL dosyası

Mevcut proje farklı klasör standardı kullanıyorsa mevcut standarda uy.

# 20. SQL çıktı kuralları

SQL migration dosyalarının çalıştırılma sırasını belirt.

Her migration için:

* Amacını yorum satırıyla yaz.
* Gerekli extension’ları açıkça belirt.
* Foreign key’leri gerçek mevcut tabloya bağla.
* RLS’yi unutma.
* Grant ve revoke komutlarını ekle.
* Realtime publication komutlarını ekle.
* Function signature’larını açıkça göster.
* Function dönüş tiplerini typed ve kararlı yap.
* Transaction gerektiren migration’ları transaction içinde çalıştır.
* Tehlikeli `CASCADE` kullanımından kaçın.
* Rollback dosyasında nesneleri bağımlılık sırasına göre kaldır.

Next.js içinde SQL string çalıştıran hiçbir kod üretme.

# 21. Hata yönetimi ve gözlemlenebilirlik

Structured log kullan.

Loglarda bulunabilecek alanlar:

* comparison id
* job id
* attempt number
* status transition
* duration
* error category

Loglarda bulunmaması gerekenler:

* DeepSeek API key
* Supabase Service Role key
* kullanıcı access tokenı
* tam request headerları
* gereksiz kullanıcı verisi
* tam araç snapshot’u

Hata kategorileri oluştur:

* validation_error
* authentication_error
* database_error
* vehicle_not_found
* generation_timeout
* provider_error
* invalid_ai_output
* stale_job
* unknown_error

Kullanıcıya yalnızca güvenli hata kodu ve genel mesaj döndür.

# 22. Definition of done

Görev ancak aşağıdakilerin tamamı sağlandığında tamamlanmış kabul edilir:

* Kullanıcı iki veya üç araç seçtiğinde butonsuz otomatik ensure işlemi çalışıyor.
* Aynı kombinasyon ikinci kez oluşturulmuyor.
* Araç sırası sonucu değiştirmiyor.
* AI üretimi client’tan bağımsız çalışıyor.
* Aynı AI işi iki kere çalışmıyor.
* DeepSeek key client bundle’a girmiyor.
* Ready sonucu tüm kullanıcılar için yeniden kullanılabiliyor.
* Yorumlar karşılaştırmaya bağlı çalışıyor.
* Yorumlara iç içe yanıt verilebiliyor.
* RLS politikaları etkin.
* Kullanıcı başka kullanıcının yorumunu değiştiremiyor.
* Realtime ile karşılaştırma ve yorum değişiklikleri görülüyor.
* SQL migration dosyaları Supabase üzerinde çalıştırılabilir durumda.
* Next.js tarafında raw SQL bulunmuyor.
* TypeScript hatası bulunmuyor.
* Lint hatası bulunmuyor.
* En önemli concurrency ve authorization testleri geçiyor.
* Kurulum dokümantasyonu environment değişkenlerini ve webhook adımlarını açıklıyor.

# 23. Çalışma biçimi

Önce kısa bir repository analiz özeti ve değiştireceğin dosya listesini ver.

Ardından doğrudan uygulamaya geç.

Yalnızca teorik açıklama üretme.

Eksik görülen mevcut kodu profesyonel biçimde tamamla.

Mevcut araç tablosu veya auth sistemiyle çelişen varsayım yapma.

Her önemli aşamadan sonra:

* Değiştirilen dosyaları
* Yapılan işlemi
* Çalıştırılması gereken migration’ı
* Test sonucunu

kısa şekilde belirt.

İşin sonunda aşağıdakileri ver:

1. Oluşturulan dosyaların listesi
2. SQL migration çalıştırma sırası
3. Supabase Dashboard üzerinde yapılacak manuel işlemler
4. Gerekli environment variables
5. Edge Function deploy komutu
6. Type generation komutu
7. Test komutları
8. Bilinen sınırlamalar
9. Güvenlik kontrol listesi
