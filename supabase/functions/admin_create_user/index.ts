// supabase/functions/admin_create_user/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const getEnv = (k: string) =>
  typeof Deno !== "undefined" && typeof Deno.env?.get === "function"
    ? Deno.env.get(k)
    : undefined;

const SUPABASE_URL =
  getEnv("HUB_SUPABASE_URL") ?? getEnv("SUPABASE_URL") ?? getEnv("URL");

const SUPABASE_SERVICE_ROLE_KEY =
  getEnv("HUB_SUPABASE_SERVICE_ROLE_KEY") ??
  getEnv("SUPABASE_SERVICE_ROLE_KEY") ??
  getEnv("SERVICE_ROLE_KEY");

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function genTempPassword() {
  return (
    Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => (b % 36).toString(36))
      .join("") + "!A1"
  );
}

export default async function (req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, {
      error: "missing_env",
      details: {
        SUPABASE_URL_present: !!SUPABASE_URL,
        SERVICE_ROLE_present: !!SUPABASE_SERVICE_ROLE_KEY,
      },
    });
  }

  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return json(401, { error: "missing_auth" });

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Validate caller JWT + get caller id
  const { data: callerData, error: callerErr } = await adminClient.auth.getUser(
    bearer,
  );

  if (callerErr || !callerData?.user?.id) {
    return json(401, { error: "invalid_token", details: callerErr ?? null });
  }

  const callerId = callerData.user.id;

  // Caller must be Admin in user_profiles
  const { data: callerProfile, error: profErr } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();

  if (profErr) return json(500, { error: "profile_lookup_failed", details: profErr });

  if ((callerProfile?.role ?? "") !== "Admin") {
    return json(403, { error: "forbidden" });
  }

  // Parse request body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const {
    email,
    full_name,
    role,
    status,
    home_store_id,
    invite = false,
    tempPassword: providedTempPassword,
    redirectTo,
  } = body ?? {};

  if (!email || !full_name) {
    return json(400, { error: "missing_fields", required: ["email", "full_name"] });
  }

  const tempPassword = providedTempPassword || genTempPassword();

  // Create Auth user
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: false,
  });

  // Supabase-js v2 returns created.user.id
  let userId = created?.user?.id;

  // If user already exists, try to locate by listing users (best-effort)
  if (!userId && createErr) {
    // try to find existing user if error is "already registered"
    // listUsers is paginated; we’ll scan first 5 pages x 200 to keep it simple but effective
    for (let page = 1; page <= 5 && !userId; page++) {
      const { data: listData, error: listErr } = await adminClient.auth.admin.listUsers({
        page,
        perPage: 200,
      });

      if (listErr) break;
      const found = (listData?.users ?? []).find(
        (u) => (u.email ?? "").toLowerCase() === String(email).toLowerCase(),
      );
      if (found?.id) userId = found.id;
    }

    if (!userId) {
      return json(500, { error: "create_user_failed", details: createErr });
    }
  }

  if (!userId) {
    return json(500, { error: "create_user_failed", details: createErr ?? "unknown" });
  }

  // Upsert user profile
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

  if (upsertErr) return json(500, { error: "profile_upsert_failed", details: upsertErr });

  // Optional invite email
  let inviteSent = false;
  let actionLink: string | null = null;

  if (invite) {
    try {
      // Prefer invite email (sends email)
      const { data: inviteData, error: inviteErr } =
        await adminClient.auth.admin.inviteUserByEmail(email, {
          redirectTo: redirectTo || undefined,
        });

      if (!inviteErr) {
        inviteSent = true;
        actionLink = (inviteData as any)?.action_link ?? null;
      }
    } catch {
      // ignore
    }
  }

  return json(200, {
    id: userId,
    inviteSent,
    actionLink,
    tempPassword: inviteSent ? undefined : tempPassword,
  });
}
