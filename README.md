# Araç Öneri Motoru

Next.js App Router ile hazırlanmış, Vercel'e doğrudan deploy edilebilecek açıklanabilir araç öneri uygulaması.

Kullanıcı fiyat aralığı, gövde tipi, yakıt tipi, şanzıman ve önceliklerini seçer. `/api/recommendations` endpoint'i JSON veri setini filtreler, araçları skorlar ve "Sana en uygunlar", "Güvenli seçim", "Bütçe dostu akıllı seçim" gibi başlıklarda nedenleriyle birlikte döndürür.

> Not: `src/data/cars.json` içindeki araçlar ve fiyatlar demo amaçlı temsili veridir. Üretimde bu dosyayı güncel, kaynaklı ve daha büyük bir veri setiyle değiştirmen gerekir.

## Getting Started

Geliştirme sunucusu:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Veri Seti

Ana veri dosyası:

```text
src/data/cars.json
```

Skorlama ve açıklama mantığı:

```text
src/lib/recommendations.ts
```

API route:

```text
src/app/api/recommendations/route.ts
```

## Vercel

1. Bu repoyu GitHub'a gönder.
2. Vercel'de "New Project" ile repoyu seç.
3. Framework preset olarak Next.js otomatik algılanır.
4. Build command `npm run build`, output ayarı varsayılan kalabilir.

## Komutlar

```bash
npm run lint
npm run build
```
