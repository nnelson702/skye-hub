import { createClient } from "@supabase/supabase-js";

// Edge Function to create or upsert a user (service role required)
// - Expects Authorization: Bearer <access_token> (admin performing action)
// - Body: { email, full_name, role, status, home_store_id }
// Security: Uses SUPABASE_SERVICE_ROLE_KEY; checks that caller is an Admin by
// validating the provided access token and querying user_profiles.role

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // In Functions runtime this will never run at import if envs are present,
  // but keep defensive checks for local tests.
  console.warn("admin_upsert_user: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
}

const adminClient = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

function genTempPassword() {
  // Simple temporary password generator (32 chars)
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => (b % 36).toString(36))
    .join("") + "!A1";
}

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const auth = req.headers.get("authorization") || "";
    const bearer = auth.replace(/^Bearer\s+/i, "");
    if (!bearer) return new Response(JSON.stringify({ error: "missing_auth" }), { status: 401 });

    // Validate caller token and ensure they are an Admin
    const { data: callerData, error: callerErr } = await adminClient.auth.getUser(bearer);
    if (callerErr || !callerData?.user) return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401 });
    const callerId = callerData.user.id;

    // Check role in user_profiles
    const { data: profileRows, error: profileErr } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("id", callerId)
      .limit(1)
      .maybeSingle();

    if (profileErr) return new Response(JSON.stringify({ error: "profile_lookup_failed", details: profileErr }), { status: 500 });
    const callerRole = (profileRows as { role?: string } | null)?.role;
    if (!callerRole || callerRole !== "Admin") return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });

    const body = await req.json();
    const { email, full_name, role, status, home_store_id } = body;

    if (!email || !full_name) return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400 });

    // Create an Auth user with a temporary password
    const tempPassword = genTempPassword();
    // NOTE: using adminClient.auth.admin.* APIs (may differ by client version). We'll use the admin endpoint.
    // If client lib version differs, adjust accordingly.
    // admin APIs might not have type definitions in this environment; use a minimal-safe call and extract id
    // @ts-expect-error allow admin API call without full typing
    const createResRaw = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: false,
    });

    type CreateRes = { data?: { id?: string } | null; error?: unknown };
    const createRes = createResRaw as unknown as CreateRes;

    let userId: string | undefined = createRes?.data?.id;

    if (!userId) {
      // If create failed or user already exists, try to find by listing users (best-effort)
      // @ts-expect-error allow admin API listUsers without full typing
      const listResRaw = await adminClient.auth.admin.listUsers?.({}) || { data: null, error: null };
      type ListRes = { data?: { users?: Array<{ id: string; email?: string }> } | null; error?: unknown };
      const listRes = listResRaw as unknown as ListRes;
      const existingErr = listRes.error;
      if (existingErr) return new Response(JSON.stringify({ error: "create_user_failed", details: existingErr }), { status: 500 });
      const found = listRes?.data?.users?.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
      if (!found) return new Response(JSON.stringify({ error: "create_user_failed" }), { status: 500 });
      userId = found.id;
    }
    if (!userId) return new Response(JSON.stringify({ error: "no_user_id" }), { status: 500 });

    // Upsert profile record
    const profilePayload = {
      id: userId,
      full_name,
      email,
      role: role || "Employee",
      status: status || "active",
      home_store_id: home_store_id || null,
    };

    const { error: upsertErr } = await adminClient.from("user_profiles").upsert(profilePayload, { onConflict: "id" });
    if (upsertErr) return new Response(JSON.stringify({ error: "profile_upsert_failed", details: upsertErr }), { status: 500 });

    // Optional: You may trigger a password reset email by calling the client REST endpoint or using SMTP/invite flow.
    // For now, return the new user id (and temp password so admin can relay it securely).

    return new Response(JSON.stringify({ id: userId, tempPassword: tempPassword }), { status: 200 });
  } catch (err) {
    console.error("admin_upsert_user error:", err);
    return new Response(JSON.stringify({ error: "internal", details: String(err) }), { status: 500 });
  }
}
