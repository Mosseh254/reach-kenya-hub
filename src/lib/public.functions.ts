import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type PackageRow = Database["public"]["Tables"]["packages"]["Row"];
export type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"] & {
  advertiser: Database["public"]["Tables"]["advertisers"]["Row"] | null;
  materials: Database["public"]["Tables"]["campaign_materials"]["Row"][];
};

/** Public catalogue: active packages, active campaigns and public settings. */
export const getPublicCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [pk, camps, settings] = await Promise.all([
    sb.from("packages").select("*").eq("is_active", true).order("sort_order"),
    sb
      .from("campaigns")
      .select("*, advertiser:advertisers(*), materials:campaign_materials(*)")
      .eq("is_active", true)
      .order("created_at"),
    sb.from("app_settings").select("key,value").eq("is_public", true),
  ]);
  const settingsMap: Record<string, Json> = {};
  for (const s of settings.data ?? []) settingsMap[s.key] = s.value;
  return {
    packages: (pk.data ?? []) as PackageRow[],
    campaigns: (camps.data ?? []) as unknown as CampaignRow[],
    settings: settingsMap,
    error: pk.error?.message ?? camps.error?.message ?? null,
  };
});
