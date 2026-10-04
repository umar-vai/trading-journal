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

function validToken(value: unknown) {
  const token = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token) ? token : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  async function currentUser() {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return null;
    const { data, error } = await admin.auth.getUser(jwt);
    return error ? null : data.user;
  }

  async function loadShare(token: string) {
    const { data, error } = await admin.from("strategy_shares").select("*").eq("token", token).eq("active", true).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null;
    return data;
  }

  let input: any = {};
  try { input = await req.json(); } catch { input = {}; }
  const action = String(input.action || "get");

  try {
    if (action === "create") {
      const user = await currentUser();
      if (!user) return json({ error: "Sign in required" }, 401);
      const strategyId = String(input.strategyId || "");
      const mode = input.mode === "clone" ? "clone" : input.mode === "view" ? "view" : "";
      if (!strategyId || !mode) return json({ error: "Strategy and share mode are required" }, 400);

      const { data: strategy, error: strategyError } = await admin.from("strategies")
        .select("id,name,description,status,markets,primary_timeframe,higher_timeframe,min_rr,preferred_session,current_version,created_at")
        .eq("id", strategyId).eq("user_id", user.id).maybeSingle();
      if (strategyError) throw strategyError;
      if (!strategy) return json({ error: "Strategy not found" }, 404);

      const [{ data: rules, error: rulesError }, { data: examples, error: examplesError }] = await Promise.all([
        admin.from("strategy_rules").select("id,rule_text,sort_order,is_active,importance").eq("strategy_id", strategyId).eq("user_id", user.id).order("sort_order"),
        admin.from("rule_examples").select("id,rule_id,rule_text_snapshot,rule_sort_order,bucket_path,caption,created_at").eq("strategy_id", strategyId).eq("user_id", user.id).order("rule_sort_order").order("created_at"),
      ]);
      if (rulesError) throw rulesError;
      if (examplesError) throw examplesError;

      const snapshot = {
        strategy: {
          name: strategy.name,
          description: strategy.description,
          status: strategy.status,
          markets: strategy.markets || [],
          primary_timeframe: strategy.primary_timeframe,
          higher_timeframe: strategy.higher_timeframe,
          min_rr: strategy.min_rr,
          preferred_session: strategy.preferred_session,
          current_version: strategy.current_version,
        },
        rules: (rules || []).map((rule: any) => ({
          source_rule_id: rule.id,
          rule_text: rule.rule_text,
          sort_order: rule.sort_order,
          is_active: rule.is_active,
          importance: rule.importance || "important",
        })),
        examples: (examples || []).map((example: any) => ({
          source_rule_id: example.rule_id,
          rule_text_snapshot: example.rule_text_snapshot,
          rule_sort_order: example.rule_sort_order,
          bucket_path: example.bucket_path,
          caption: example.caption,
        })),
      };

      const { data: existing, error: existingError } = await admin.from("strategy_shares")
        .select("id,token").eq("owner_user_id", user.id).eq("strategy_id", strategyId).eq("share_mode", mode).eq("active", true).maybeSingle();
      if (existingError) throw existingError;

      if (existing) {
        const { error: updateError } = await admin.from("strategy_shares").update({
          snapshot,
          strategy_version: strategy.current_version || 1,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id).eq("owner_user_id", user.id);
        if (updateError) throw updateError;
        return json({ token: existing.token, mode, reused: true });
      }

      const { data: created, error: createError } = await admin.from("strategy_shares").insert({
        owner_user_id: user.id,
        strategy_id: strategyId,
        share_mode: mode,
        strategy_version: strategy.current_version || 1,
        snapshot,
      }).select("id,token,share_mode,created_at").single();
      if (createError) throw createError;
      return json({ token: created.token, mode: created.share_mode, createdAt: created.created_at, reused: false });
    }

    if (action === "get") {
      const token = validToken(input.token);
      if (!token) return json({ error: "Invalid share link" }, 400);
      const share = await loadShare(token);
      if (!share) return json({ error: "This share link is unavailable or has been revoked." }, 404);

      const snapshot = share.snapshot || {};
      const examples = Array.isArray(snapshot.examples) ? snapshot.examples : [];
      const withUrls = await Promise.all(examples.map(async (example: any) => {
        if (!example.bucket_path) return { ...example, imageUrl: null };
        const { data } = await admin.storage.from("trade-screenshots").createSignedUrl(example.bucket_path, 3600);
        return { ...example, imageUrl: data?.signedUrl || null };
      }));

      return json({
        mode: share.share_mode,
        strategyVersion: share.strategy_version,
        createdAt: share.created_at,
        strategy: snapshot.strategy || null,
        rules: Array.isArray(snapshot.rules) ? snapshot.rules : [],
        examples: withUrls,
      });
    }

    if (action === "revoke") {
      const user = await currentUser();
      if (!user) return json({ error: "Sign in required" }, 401);
      const token = validToken(input.token);
      if (!token) return json({ error: "Invalid share link" }, 400);
      const { error } = await admin.from("strategy_shares").update({ active: false, updated_at: new Date().toISOString() })
        .eq("token", token).eq("owner_user_id", user.id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "import") {
      const user = await currentUser();
      if (!user) return json({ error: "Sign in required" }, 401);
      const token = validToken(input.token);
      if (!token) return json({ error: "Invalid share link" }, 400);
      const share = await loadShare(token);
      if (!share) return json({ error: "This share link is unavailable or has been revoked." }, 404);
      if (share.share_mode !== "clone") return json({ error: "This is a view-only share link." }, 403);

      const snapshot = share.snapshot || {};
      const sourceStrategy = snapshot.strategy || {};
      const sourceRules = Array.isArray(snapshot.rules) ? snapshot.rules : [];
      if (!sourceStrategy.name || !sourceRules.length) return json({ error: "Shared strategy snapshot is incomplete." }, 422);

      const strategyPayload = {
        user_id: user.id,
        name: sourceStrategy.name,
        description: sourceStrategy.description || null,
        status: sourceStrategy.status === "archived" ? "testing" : (sourceStrategy.status || "testing"),
        markets: Array.isArray(sourceStrategy.markets) ? sourceStrategy.markets : [],
        primary_timeframe: sourceStrategy.primary_timeframe || null,
        higher_timeframe: sourceStrategy.higher_timeframe || null,
        min_rr: sourceStrategy.min_rr ?? null,
        preferred_session: sourceStrategy.preferred_session || null,
        current_version: 1,
      };

      const { data: newStrategy, error: strategyError } = await admin.from("strategies").insert(strategyPayload).select("*").single();
      if (strategyError) throw strategyError;

      try {
        const ruleRows = sourceRules.map((rule: any, index: number) => ({
          strategy_id: newStrategy.id,
          user_id: user.id,
          rule_text: String(rule.rule_text || "").trim(),
          sort_order: Number.isFinite(Number(rule.sort_order)) ? Number(rule.sort_order) : index,
          is_active: rule.is_active !== false,
          importance: ["mandatory", "important", "optional"].includes(rule.importance) ? rule.importance : "important",
        }));
        const { data: newRules, error: rulesError } = await admin.from("strategy_rules").insert(ruleRows).select("id,rule_text,sort_order,importance");
        if (rulesError) throw rulesError;

        const { error: versionError } = await admin.from("strategy_versions").insert({
          strategy_id: newStrategy.id,
          user_id: user.id,
          version: 1,
          strategy_snapshot: { ...strategyPayload, current_version: 1 },
          rules_snapshot: ruleRows.map((rule: any) => ({ rule_text: rule.rule_text, sort_order: rule.sort_order, importance: rule.importance })),
          change_note: "Imported from a shared strategy",
        });
        if (versionError) throw versionError;

        const sourceToNew = new Map<string, any>();
        for (const sourceRule of sourceRules) {
          const match = (newRules || []).find((item: any) => Number(item.sort_order) === Number(sourceRule.sort_order));
          if (sourceRule.source_rule_id && match) sourceToNew.set(sourceRule.source_rule_id, match);
        }

        let copiedExamples = 0;
        const copyWarnings: string[] = [];
        const examples = Array.isArray(snapshot.examples) ? snapshot.examples : [];
        for (const example of examples) {
          try {
            const newRule = example.source_rule_id ? sourceToNew.get(example.source_rule_id) : (newRules || []).find((item: any) => Number(item.sort_order) === Number(example.rule_sort_order));
            if (!newRule || !example.bucket_path) continue;
            const { data: fileData, error: downloadError } = await admin.storage.from("trade-screenshots").download(example.bucket_path);
            if (downloadError || !fileData) throw downloadError || new Error("Source image unavailable");
            const original = String(example.bucket_path).split("/").pop() || "shared-chart.png";
            const extension = original.includes(".") ? original.split(".").pop() : "png";
            const destination = `${user.id}/rules/${newStrategy.id}/${newRule.id}/${crypto.randomUUID()}-shared.${extension}`;
            const { error: uploadError } = await admin.storage.from("trade-screenshots").upload(destination, fileData, { contentType: fileData.type || undefined, upsert: false });
            if (uploadError) throw uploadError;
            const { error: exampleError } = await admin.from("rule_examples").insert({
              user_id: user.id,
              strategy_id: newStrategy.id,
              rule_id: newRule.id,
              rule_text_snapshot: newRule.rule_text,
              rule_sort_order: newRule.sort_order,
              bucket_path: destination,
              caption: example.caption || null,
            });
            if (exampleError) {
              await admin.storage.from("trade-screenshots").remove([destination]);
              throw exampleError;
            }
            copiedExamples += 1;
          } catch (copyError) {
            copyWarnings.push(copyError instanceof Error ? copyError.message : "Could not copy one chart example");
          }
        }

        await admin.from("strategy_shares").update({ import_count: Number(share.import_count || 0) + 1, updated_at: new Date().toISOString() }).eq("id", share.id);
        return json({ strategyId: newStrategy.id, copiedExamples, warnings: copyWarnings.slice(0, 3) });
      } catch (error) {
        await admin.from("strategies").delete().eq("id", newStrategy.id).eq("user_id", user.id);
        throw error;
      }
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("strategy-share error", error);
    return json({ error: error instanceof Error ? error.message : "Strategy sharing request failed" }, 500);
  }
});
