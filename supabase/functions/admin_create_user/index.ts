// Supabase Edge Function: admin_create_user
// Full copy/replace file content

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(k: string) {
  try {
    return Deno.env.get(k);
  } catch {
    return undefined;
  }
}

// Accept either HUB_* or standard Supabase names
const SUPABASE_URL =
  getEnv("HUB_SUPABASE_URL") ??
  getEnv("SUPABASE_URL") ??
  getEnv("URL");

const SERVICE_ROLE_KEY =
  getEnv("HUB_SUPABASE_SERVICE_ROLE_KEY") ??
  getEnv("SUPABASE_SERVICE_ROLE_KEY") ??
  getEnv("SERVICE_ROLE_KEY");

const HUB_SITE_URL = getEnv("HUB_SITE_URL");
const HUB_REDIRECT_URL = getEnv("HUB_REDIRECT_URL"); // optional override

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("admin_create_user missing env:", {
    hasUrl: !!SUPABASE_URL,
    hasServiceRole: !!SERVICE_ROLE_KEY,
  });
}

const adminClient = createClient(SUPABASE_URL ?? "", SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false },
});

function genTempPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const base = Array.from(bytes)
    .map((b) => (b % 36).toString(36))
    .join("");
  return `${base}!A1`;
}

export default async function handler(req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  // Fail fast if env missing (so we stop guessing)
  const checkedEnv = {
    SUPABASE_URL: ["HUB_SUPABASE_URL", "SUPABASE_URL", "URL"],
    SERVICE_ROLE_KEY: ["HUB_SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"],
  };

  const missing: Record<string, string[]> = {};
  if (!SUPABASE_URL) missing.SUPABASE_URL = checkedEnv.SUPABASE_URL;
  if (!SERVICE_ROLE_KEY) missing.SERVICE_ROLE_KEY = checkedEnv.SERVICE_ROLE_KEY;
  if (Object.keys(missing).length) return json({ error: "missing_env", details: missing }, 500);

  // Auth header required
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return json({ error: "missing_auth" }, 401);

  // Validate caller token and role
  const { data: callerData, error: callerErr } = await adminClient.auth.getUser(bearer);
  if (callerErr || !callerData?.user) {
    return json({ error: "invalid_token", details: callerErr?.message ?? "no user" }, 401);
  }

  const callerId = callerData.user.id;

  const { data: profile, error: profileErr } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();

  if (profileErr) return json({ error: "profile_lookup_failed", details: profileErr }, 500);

  const callerRole = (profile as { role?: string } | null)?.role;
  if (callerRole !== "Admin") return json({ error: "forbidden" }, 403);

  // Parse request body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const {
    email,
    full_name,
    role,
    status,
    home_store_id,
    invite = true,
    tempPassword: providedTempPassword,
    redirectTo: reqRedirect,
  } = body ?? {};

  if (!email || !full_name) return json({ error: "missing_fields", required: ["email", "full_name"] }, 400);

  const tempPassword = providedTempPassword || genTempPassword();

  // Create Auth user (or find existing)
  let userId: string | undefined;

  const createRes = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: false,
  });

  if (createRes?.data?.user?.id) {
    userId = createRes.data.user.id;
  } else {
    // If already exists, try finding it
    const listRes = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = listRes?.data?.users?.find((u) => (u.email ?? "").toLowerCase() === String(email).toLowerCase());
    if (!found?.id) return json({ error: "create_user_failed", details: createRes?.error ?? null }, 500);
    userId = found.id;
  }

  // Upsert profile record
  const profilePayload = {
    id: userId,
    full_name,
    email,
    role: role || "Employee",
    status: status || "active",
    home_store_id: home_store_id || null,
    must_reset_password: invite ? false : true,
  };

  const { error: upsertErr } = await adminClient
    .from("user_profiles")
    .upsert(profilePayload, { onConflict: "id" });

  if (upsertErr) return json({ error: "profile_upsert_failed", details: upsertErr }, 500);

  // Try generate recovery link (optional)
  let inviteSent = false;
  let resetLink: string | null = null;

  try {
    const redirectTo =
      reqRedirect ??
      HUB_REDIRECT_URL ??
      (HUB_SITE_URL ? `${HUB_SITE_URL.replace(/\/$/, "")}/reset-password` : undefined);

    const linkRes = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });

    resetLink = linkRes?.data?.properties?.action_link ?? null;
    if (resetLink) inviteSent = true;
  } catch (e) {
    console.warn("admin_create_user generateLink failed:", e);
  }

  // Return results
  const result: any = { id: userId, inviteSent };

  if (resetLink) result.resetLink = resetLink;
  if (!inviteSent) result.tempPassword = tempPassword;

  return json(result, 200);
}
