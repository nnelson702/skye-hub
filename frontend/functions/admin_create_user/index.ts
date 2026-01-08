// supabase/functions/admin_create_user/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const getEnv = (k: string) => {
  try {
    return Deno.env.get(k);
  } catch {
    return undefined;
  }
};

const SUPABASE_URL =
  getEnv("HUB_SUPABASE_URL") ?? getEnv("SUPABASE_URL") ?? getEnv("URL");

const SUPABASE_SERVICE_ROLE_KEY =
  getEnv("HUB_SUPABASE_SERVICE_ROLE_KEY") ??
  getEnv("SUPABASE_SERVICE_ROLE_KEY") ??
  getEnv("SERVICE_ROLE_KEY");

const HUB_SITE_URL = getEnv("HUB_SITE_URL");
const HUB_REDIRECT_URL = getEnv("HUB_REDIRECT_URL");

function corsHeaders(origin: string | null) {
  // If you want to lock this down later, change "*" to an allowlist check.
  const allowOrigin = origin ?? "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
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
  const origin = req.headers.get("origin");

  // ✅ Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" }, origin);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(
      500,
      {
        error: "missing_env",
        details: {
          SUPABASE_URL: ["HUB_SUPABASE_URL", "SUPABASE_URL", "URL"],
          SERVICE_ROLE_KEY: [
            "HUB_SUPABASE_SERVICE_ROLE_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
            "SERVICE_ROLE_KEY",
          ],
        },
      },
      origin
    );
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ✅ Supabase Edge Functions gateway often expects BOTH:
  // - Authorization: Bearer <user jwt>
  // - apikey: <anon key>
  // The gateway enforces apikey; the function enforces Authorization.
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) {
    return json(401, { error: "missing_auth" }, origin);
  }

  // Validate caller token
  const { data: callerData, error: callerErr } = await adminClient.auth.getUser(bearer);
  if (callerErr || !callerData?.user) {
    return json(401, { error: "invalid_token", details: String(callerErr?.message ?? callerErr) }, origin);
  }
  const callerId = callerData.user.id;

  // Authorization: must be Admin in user_profiles
  const { data: profileRow, error: profileErr } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();

  if (profileErr) {
    return json(500, { error: "profile_lookup_failed", details: profileErr }, origin);
  }
  const callerRole = (profileRow as { role?: string } | null)?.role;
  if (callerRole !== "Admin") {
    return json(403, { error: "forbidden" }, origin);
  }

  // Parse request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" }, origin);
  }

  const {
    email,
    full_name,
    role = "Employee",
    status = "active",
    home_store_id = null,
    invite = true,
    tempPassword: providedTempPassword,
    redirectTo: reqRedirect,
  } = body ?? {};

  if (!email || !full_name) {
    return json(400, { error: "missing_fields", required: ["email", "full_name"] }, origin);
  }

  const redirectTo =
    reqRedirect ??
    HUB_REDIRECT_URL ??
    (HUB_SITE_URL ? `${HUB_SITE_URL}/reset-password` : undefined);

  let userId: string | undefined;

  // If "invite", prefer the built-in invite email send (this actually emails)
  if (invite) {
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

    if (error) {
      // If user already exists, return a clean error so UI can show "use reset"
      // Supabase messages vary; keep it simple.
      return json(409, { error: "invite_failed", details: error.message }, origin);
    }

    userId = data.user?.id;
  } else {
    const tempPassword = providedTempPassword || genTempPassword();

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: false,
    });

    if (error) {
      return json(500, { error: "create_user_failed", details: error.message }, origin);
    }

    userId = data.user?.id;

    if (!userId) {
      return json(500, { error: "create_user_failed_no_id" }, origin);
    }
  }

  // Upsert profile
  const profilePayload = {
    id: userId,
    full_name,
    email,
    role,
    status,
    home_store_id,
    must_reset_password: invite ? true : true, // keeping your original intent: new users must reset/activate
  };

  const { error: upsertErr } = await adminClient
    .from("user_profiles")
    .upsert(profilePayload, { onConflict: "id" });

  if (upsertErr) {
    return json(500, { error: "profile_upsert_failed", details: upsertErr }, origin);
  }

  return json(200, { id: userId, inviteSent: !!invite }, origin);
}
