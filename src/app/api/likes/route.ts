// Bu dosya artık kullanılmıyor.
// Tüm like ve favorite işlemleri /api/interactions üzerinden yapılmaktadır.
// Geriye dönük uyumluluk için boş bir 404 döndürülüyor.

export async function GET() {
  return Response.json(
    { error: "Bu endpoint kullanımdan kaldırıldı. /api/interactions kullanın." },
    { status: 404 },
  );
}

export async function POST() {
  return Response.json(
    { error: "Bu endpoint kullanımdan kaldırıldı. /api/interactions kullanın." },
    { status: 404 },
  );
}
