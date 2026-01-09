// supabase/functions/admin_create_user/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id",
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

/**
 * Structured response helper
 */
function jsonResponse(status: number, payload: {
  ok: boolean;
  data?: unknown;
  error?: { message: string; code?: string; details?: unknown };
  correlationId?: string;
}) {
  return new Response(JSON.stringify(payload), {
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
  // Extract correlation ID for tracking
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();

  console.log(`[admin_create_user] Request received (correlation: ${correlationId})`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, {
      ok: false,
      error: { message: "Method Not Allowed", code: "METHOD_NOT_ALLOWED" },
      correlationId,
    });
  }

  // Validate environment variables
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(`[admin_create_user] Missing environment variables (correlation: ${correlationId})`);
    return jsonResponse(500, {
      ok: false,
      error: {
        message: "Server configuration error: missing required environment variables",
        code: "MISSING_ENV",
        details: {
          SUPABASE_URL_present: !!SUPABASE_URL,
          SERVICE_ROLE_present: !!SUPABASE_SERVICE_ROLE_KEY,
        },
      },
      correlationId,
    });
  }

  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) {
    return jsonResponse(401, {
      ok: false,
      error: { message: "Missing authorization token", code: "MISSING_AUTH" },
      correlationId,
    });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Validate caller JWT + get caller id
  const { data: callerData, error: callerErr } = await adminClient.auth.getUser(
    bearer,
  );

  if (callerErr || !callerData?.user?.id) {
    console.error(`[admin_create_user] Invalid token (correlation: ${correlationId}):`, callerErr);
    return jsonResponse(401, {
      ok: false,
      error: { message: "Invalid or expired token", code: "INVALID_TOKEN", details: callerErr },
      correlationId,
    });
  }

  const callerId = callerData.user.id;

  // Caller must be Admin in user_profiles
  const { data: callerProfile, error: profErr } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();

  if (profErr) {
    console.error(`[admin_create_user] Profile lookup failed (correlation: ${correlationId}):`, profErr);
    return jsonResponse(500, {
      ok: false,
      error: { message: "Failed to verify admin permissions", code: "PROFILE_LOOKUP_FAILED", details: profErr },
      correlationId,
    });
  }

  if ((callerProfile?.role ?? "") !== "Admin") {
    console.warn(`[admin_create_user] Non-admin attempted access (correlation: ${correlationId}), caller: ${callerId}`);
    return jsonResponse(403, {
      ok: false,
      error: { message: "Forbidden: Admin role required", code: "FORBIDDEN" },
      correlationId,
    });
  }

  // Parse request body
  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    return jsonResponse(400, {
      ok: false,
      error: { message: "Invalid JSON in request body", code: "INVALID_JSON" },
      correlationId,
    });
  }

  // Check for password reset mode
  const mode = body?.mode;
  
  if (mode === "reset") {
    // PASSWORD RESET MODE: Send password reset email to existing user
    const { email, redirectTo } = body ?? {};
    
    if (!email) {
      return jsonResponse(400, {
        ok: false,
        error: { message: "Email is required for password reset", code: "MISSING_FIELDS" },
        correlationId,
      });
    }
    
    console.log(`[admin_create_user] Sending password reset (correlation: ${correlationId}), email: ${email}`);
    
    try {
      const { data: resetData, error: resetErr } = 
        await adminClient.auth.resetPasswordForEmail(email, {
          redirectTo: redirectTo || undefined,
        });
      
      if (resetErr) {
        console.error(`[admin_create_user] Password reset failed (correlation: ${correlationId}):`, resetErr);
        return jsonResponse(500, {
          ok: false,
          error: { message: "Failed to send password reset email", code: "RESET_FAILED", details: resetErr },
          correlationId,
        });
      }
      
      console.log(`[admin_create_user] Password reset sent successfully (correlation: ${correlationId})`);
      
      return jsonResponse(200, {
        ok: true,
        data: { resetLink: null }, // Supabase doesn't return action_link for resetPasswordForEmail
        correlationId,
      });
    } catch (e) {
      console.error(`[admin_create_user] Password reset exception (correlation: ${correlationId}):`, e);
      return jsonResponse(500, {
        ok: false,
        error: { message: "Password reset exception", code: "RESET_EXCEPTION", details: String(e) },
        correlationId,
      });
    }
  }

  // USER CREATION MODE (default)
  console.log(`[admin_create_user] Creating user (correlation: ${correlationId})`);
  
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
    return jsonResponse(400, {
      ok: false,
      error: { message: "Email and full name are required", code: "MISSING_FIELDS" },
      correlationId,
    });
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
      console.error(`[admin_create_user] User creation failed and not found (correlation: ${correlationId}):`, createErr);
      return jsonResponse(500, {
        ok: false,
        error: { message: "Failed to create user", code: "CREATE_USER_FAILED", details: createErr },
        correlationId,
      });
    }
  }

  if (!userId) {
    console.error(`[admin_create_user] No userId after creation (correlation: ${correlationId})`);
    return jsonResponse(500, {
      ok: false,
      error: { message: "User creation returned no ID", code: "CREATE_USER_FAILED", details: createErr },
      correlationId,
    });
  }

  console.log(`[admin_create_user] User created/found (correlation: ${correlationId}), userId: ${userId}`);

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

  if (upsertErr) {
    console.error(`[admin_create_user] Profile upsert failed (correlation: ${correlationId}):`, upsertErr);
    return jsonResponse(500, {
      ok: false,
      error: { message: "Failed to create user profile", code: "PROFILE_UPSERT_FAILED", details: upsertErr },
      correlationId,
    });
  }

  console.log(`[admin_create_user] Profile upserted successfully (correlation: ${correlationId})`);

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
        console.log(`[admin_create_user] Invite email sent (correlation: ${correlationId})`);
      } else {
        console.warn(`[admin_create_user] Invite email failed (correlation: ${correlationId}):`, inviteErr);
      }
    } catch (e) {
      console.error(`[admin_create_user] Invite email exception (correlation: ${correlationId}):`, e);
    }
  }

  console.log(`[admin_create_user] User creation complete (correlation: ${correlationId})`);

  return jsonResponse(200, {
    ok: true,
    data: {
      id: userId,
      inviteSent,
      resetLink: actionLink,
      tempPassword: inviteSent ? undefined : tempPassword,
    },
    correlationId,
  });
}
