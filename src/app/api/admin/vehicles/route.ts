import { NextRequest } from "next/server";
import { getAdminState } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ADMIN_VEHICLE_SELECT, parseAdminVehiclePayload, type AdminVehicle } from "@/lib/vehicles/admin";

const DEFAULT_PAGE_SIZE = 18;

export async function GET(request: NextRequest) {
  try {
    const adminState = await getAdminState();
    if (!adminState.isAdmin) return Response.json({ error: "Yetkin yok." }, { status: 403 });

    const admin = createSupabaseAdminClient();
    const id = request.nextUrl.searchParams.get("id")?.trim();

    if (id) {
      const { data, error } = await admin
        .from("vehicle_market_profiles")
        .select(ADMIN_VEHICLE_SELECT)
        .eq("id", id)
        .maybeSingle();

      if (error) return Response.json({ error: "Araç alınamadı." }, { status: 500 });
      if (!data) return Response.json({ error: "Araç bulunamadı." }, { status: 404 });
      return Response.json({ vehicle: normalizeVehicle(data as unknown as AdminVehicle) });
    }

    const page = normalizePage(request.nextUrl.searchParams.get("page"));
    const pageSize = normalizePageSize(request.nextUrl.searchParams.get("pageSize"));
    const search = normalizeSearch(request.nextUrl.searchParams.get("q"));
    const from = page * pageSize;
    let query = admin
      .from("vehicle_market_profiles")
      .select(ADMIN_VEHICLE_SELECT, { count: "exact" });

    if (search) {
      const pattern = search.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
      query = query.or(
        ["id", "make", "model", "trim_level", "segment"].map((field) => `${field}.ilike.%${pattern}%`).join(","),
      );
    }

    const { data, error, count } = await query
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) return Response.json({ error: "Araçlar alınamadı." }, { status: 500 });

    return Response.json({
      vehicles: ((data ?? []) as unknown as AdminVehicle[]).map(normalizeVehicle),
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch {
    return Response.json({ error: "Araçlar alınamadı." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminState = await getAdminState();
    if (!adminState.isAdmin) return Response.json({ error: "Yetkin yok." }, { status: 403 });

    const body = (await request.json()) as { vehicle?: unknown };
    const parsed = parseAdminVehiclePayload(body.vehicle);
    if (parsed.error) return Response.json({ error: parsed.error }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("vehicle_market_profiles")
      .insert(parsed.vehicle)
      .select(ADMIN_VEHICLE_SELECT)
      .single();

    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      return Response.json({ error: status === 409 ? "Bu araç kimliği zaten kullanılıyor." : "Araç eklenemedi." }, { status });
    }

    return Response.json({ vehicle: normalizeVehicle(data as unknown as AdminVehicle) }, { status: 201 });
  } catch {
    return Response.json({ error: "Araç eklenemedi." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const adminState = await getAdminState();
    if (!adminState.isAdmin) return Response.json({ error: "Yetkin yok." }, { status: 403 });

    const body = (await request.json()) as { id?: unknown; vehicle?: unknown };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return Response.json({ error: "Araç kimliği gerekli." }, { status: 400 });

    const parsed = parseAdminVehiclePayload(body.vehicle, id);
    if (parsed.error) return Response.json({ error: parsed.error }, { status: 400 });

    const changes = { ...parsed.vehicle } as Partial<AdminVehicle>;
    delete changes.id;
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("vehicle_market_profiles")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(ADMIN_VEHICLE_SELECT)
      .maybeSingle();

    if (error) return Response.json({ error: "Araç güncellenemedi." }, { status: 500 });
    if (!data) return Response.json({ error: "Araç bulunamadı." }, { status: 404 });
    return Response.json({ vehicle: normalizeVehicle(data as unknown as AdminVehicle) });
  } catch {
    return Response.json({ error: "Araç güncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const adminState = await getAdminState();
    if (!adminState.isAdmin) return Response.json({ error: "Yetkin yok." }, { status: 403 });

    const body = (await request.json()) as { id?: unknown };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return Response.json({ error: "Araç kimliği gerekli." }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("vehicle_market_profiles").delete().eq("id", id);
    if (error) return Response.json({ error: "Araç silinemedi." }, { status: 500 });
    return Response.json({ ok: true, id });
  } catch {
    return Response.json({ error: "Araç silinemedi." }, { status: 400 });
  }
}

function normalizeVehicle(vehicle: AdminVehicle): AdminVehicle {
  const numberKeys: Array<keyof AdminVehicle> = [
    "min_seats", "power_hp", "min_year", "max_year", "min_km", "max_km",
    "market_min_price", "market_max_price", "avg_annual_cost_try", "safety_score",
    "efficiency_score", "family_score", "comfort_score", "performance_score", "youth_score",
    "resale_score", "city_score", "long_trip_score", "maintenance_score", "tech_score",
  ];
  const normalized = { ...vehicle };
  for (const key of numberKeys) {
    (normalized[key] as number) = Number(vehicle[key] ?? 0);
  }
  normalized.city_fuel_consumption = vehicle.city_fuel_consumption === null ? null : Number(vehicle.city_fuel_consumption);
  normalized.highway_fuel_consumption = vehicle.highway_fuel_consumption === null ? null : Number(vehicle.highway_fuel_consumption);
  return normalized;
}

function normalizePage(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function normalizePageSize(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(48, Math.max(6, Math.floor(parsed))) : DEFAULT_PAGE_SIZE;
}

function normalizeSearch(value: string | null) {
  return value?.trim().slice(0, 80) ?? "";
}
