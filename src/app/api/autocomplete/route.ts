import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q");

    if (!query || query.length < 2) {
      return Response.json({ suggestions: [], categories: [] });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("search_vehicles_autocomplete", {
      search_query: query,
    });

    if (error) {
      console.error("Autocomplete RPC Error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  } catch (err: any) {
    console.error("Autocomplete Error:", err);
    return Response.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
