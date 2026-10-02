import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function normalizeImpact(value: unknown) {
  const text = String(value || "").toLowerCase();
  if (text.includes("high")) return "high";
  if (text.includes("medium") || text.includes("med")) return "medium";
  if (text.includes("low")) return "low";
  return "holiday";
}

function normalizeEvent(item: any, index: number) {
  const dateRaw = item.date || item.datetime || item.time || item.timestamp || null;
  const date = dateRaw ? new Date(dateRaw) : null;
  return {
    id: String(item.id || `${item.country || item.currency || "event"}-${dateRaw || index}-${item.title || item.event || index}`),
    title: String(item.title || item.event || item.name || "Economic event"),
    country: String(item.country || item.currency || item.ccy || ""),
    impact: normalizeImpact(item.impact),
    date: date && !Number.isNaN(date.getTime()) ? date.toISOString() : String(dateRaw || ""),
    forecast: item.forecast ?? item.consensus ?? null,
    previous: item.previous ?? null,
    actual: item.actual ?? null,
    source: "Forex Factory calendar feed",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const cacheKey = "forex-factory:this-week";
  const now = new Date();

  const { data: cached } = await admin
    .from("economic_calendar_cache")
    .select("payload,fetched_at,expires_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (cached?.payload && new Date(cached.expires_at).getTime() > now.getTime()) {
    return json({ events: cached.payload, cached: true, fetchedAt: cached.fetched_at });
  }

  try {
    const response = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      headers: { "User-Agent": "TradingJournal/1.0", Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Calendar upstream returned ${response.status}`);
    const raw = await response.json();
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.events) ? raw.events : [];
    const events = list.map(normalizeEvent).filter((event: any) => event.date && event.title);
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    await admin.from("economic_calendar_cache").upsert({
      cache_key: cacheKey,
      payload: events,
      fetched_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });
    return json({ events, cached: false, fetchedAt: now.toISOString() });
  } catch (error) {
    if (cached?.payload) {
      return json({ events: cached.payload, cached: true, stale: true, fetchedAt: cached.fetched_at, warning: error instanceof Error ? error.message : "Calendar refresh failed" });
    }
    return json({ error: error instanceof Error ? error.message : "Unable to load economic calendar" }, 502);
  }
});
