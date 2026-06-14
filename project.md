Amaç: Kullanıcının girdiği bütçe ve önceliklere göre, veritabanındaki pazar profillerini analiz edip, kategorizasyon yapmadan (tek bir başlık altında) en yüksek uyum puanından en düşüğe doğru tam 10 araçlık bir hedef liste sunmak.

📍 Faz 1: İstemci (Client) ve Kullanıcı Etkileşimi
Kullanıcı sisteme giriş yapar. Amacı, kısıtlı bütçesiyle kendine en konforlu aracı bulmaktır.

Bütçe Belirleme: Kaydırıcı (slider) üzerinden bütçesini 600.000 ₺ - 750.000 ₺ olarak ayarlar. Bu zorunlu filtredir.

Öncelik Seçimi: "Öncelikler" menüsünden sadece "Konfor" seçeneğini işaretler. (Güvenlik, Ekonomi, Performans veya Genç seçeneklerini boş bırakır).

Aksiyon: "Önerileri Getir" butonuna basar.

Frontend İşlemi: Next.js ön yüzü, bu durumu bir JSON payload'una çevirir:

JSON
{
  "minBudget": 600000,
  "maxBudget": 750000,
  "priorities": {
    "comfort": 1.0,
    "safety": 0,
    "efficiency": 0,
    "performance": 0,
    "youth": 0
    // diğerleri 0
  }
}
📍 Faz 2: Arka Uç (Backend) ve Veritabanı İletişimi
İstemciden kalkan bu istek, Vercel üzerindeki API rotasına (/api/recommendations) ulaşır. API, hiçbir karmaşık matematiksel hesaba girmeden bu veriyi PostgreSQL (Supabase) veritabanının anlayacağı bir SQL sorgusuna dönüştürür.

API'nin veritabanına gönderdiği komut tam olarak şöyledir:

SQL
SELECT * FROM arac_oner(
    p_min_budget := 600000,
    p_max_budget := 750000,
    w_comfort := 1.0
    -- Seçilmeyen diğer tüm 'w_' parametreleri default olarak 0 kabul edilir.
) LIMIT 10; 
(Not: LIMIT 10 komutu ile API, veritabanından sadece en iyi 10 sonucu getirmesini ister.)

📍 Faz 3: Veritabanı (PostgreSQL) İçi Hesaplama
arac_oner fonksiyonu devreye girer.

Filtreleme (Overlap): Veritabanı önce tüm profillere bakar. Örneğin piyasa fiyatı 850.000 - 920.000 olan bir aracı anında eler. Sadece piyasa değeri 600k-750k bandıyla kesişen araçları (Örn: 2014-2016 Skoda Superb, 2018-2020 Fiat Egea, 2015-2017 Renault Megane vb.) havuza alır.

Skorlama: Toplam ağırlık sadece "Konfor" olduğu için (total_weight = 1), sistem araçların sadece comfort_score değerini baz alır.

Sıralama: Havuzdaki araçlar match_score (Uyum Puanı) değerine göre büyükten küçüğe sıralanır ve en iyi 10 tanesi API'ye geri fırlatılır.

📍 Faz 4: Kullanıcıya Sunum (Tekil ve Net Liste)
Veriler frontend'e ulaşır ve ekranda herhangi bir alt kategori ("Güvenli Seçimler", "Performanslılar" vb.) olmadan, tek bir düzlemde listelenir. Sıralama tamamen "Kullanıcının İstediği Konfor" eksenindedir.

Görsel Çıktı Senaryosu (Gerçek Veri Simülasyonu):

🏆 1. Sıradaki Araç (En Yüksek Uyum - %92): Skoda Superb (2014-2015)

Neden 1. Sırada? Çünkü kullanıcının bütçe makasına uyan (Piyasa bandı: 680k-740k) ve konfor skoru (9.2/10) en yüksek olan D segment araç budur.

Kullanıcının Gördüğü: "Geniş iç hacmi ve süspansiyon yumuşaklığı ile bütçenizdeki en konforlu seçenek."

🥈 2. Sıradaki Araç (Uyum - %88): Volkswagen Passat (2013-2014)

Neden 2. Sırada? Superb'e çok yakın bir konfor sunar (8.8/10), fiyat makası 700k-750k bandındadır. Yaş/KM olarak biraz daha yüksektir (150k - 200k km).

(...Aralıktaki diğer D ve C segment araçlar sıralanır...)

🔟 10. Sıradaki Araç (En Düşük Uyum - %65): Fiat Egea Sedan (2019-2021)

Neden 10. Sırada? Fiyat olarak kullanıcının bütçesine mükemmel uyar (Piyasa bandı: 620k-690k) ve modeli çok yenidir. Ancak, kullanıcının tek önceliği "Konfor" olduğu için ve Egea'nın konfor skoru (6.5/10) Superb veya Passat'a göre daha düşük kaldığı için listenin son sırasına yerleşir.

Kullanıcının Gördüğü: "Bütçenize uygun, modeli yeni bir alternatif ancak yalıtım ve sürüş konforu üst sıralardaki D segment araçların gerisinde kalabilir."

📌 Mimarinin Özet Çıktısı (Takeaway)
Sistem kullanıcıyı kategorilerle yormaz. Kullanıcı "Bana konfor lazım" dediği an, algoritma arka planda Egea'nın model yılının yeni olmasını veya Megane'ın yakıt ekonomisini tamamen görmezden gelir; acımasızca "Konforu en yüksek olan ve paranın yettiği arabayı" 1. sıraya çakar. Sonuç; tam kullanıcının niyetini (intent) okuyan, 10 araçlık, kişiselleştirilmiş ve kanıta dayalı (puan/fiyat bandı) tek bir kusursuz listedir.