import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("admin_create_user: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
}

const adminClient = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

function genTempPassword() {
  return (
    Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => (b % 36).toString(36))
      .join("") + "!A1"
  );
}

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const auth = req.headers.get("authorization") || "";
    const bearer = auth.replace(/^Bearer\s+/i, "");
    if (!bearer) return new Response(JSON.stringify({ error: "missing_auth" }), { status: 401 });

    const { data: callerData, error: callerErr } = await adminClient.auth.getUser(bearer);
    if (callerErr || !callerData?.user) return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401 });
    const callerId = callerData.user.id;

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
    const { email, full_name, role, status, home_store_id, invite = true, tempPassword: providedTempPassword, redirectTo } = body;

    if (!email || !full_name) return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400 });

    // Prepare temp password (if needed)
    const tempPassword = providedTempPassword || genTempPassword();

    // Create Auth user using service role; try to create a user and attempt to generate a reset link if invite requested.
    // Use adminClient.auth.admin.createUser when available; fallback attempts handled safely.

    // @ts-expect-error allow admin API usage without full typing
    const createResRaw = await adminClient.auth.admin.createUser({ email, password: tempPassword, email_confirm: false });
    type CreateRes = { data?: { id?: string } | null; error?: unknown };
    const createRes = createResRaw as unknown as CreateRes;

    let userId: string | undefined = createRes?.data?.id;

    if (!userId) {
      // Try to find existing user
      // @ts-expect-error allow admin API listUsers
      const listResRaw = (await adminClient.auth.admin.listUsers?.({})) || { data: null, error: null };
      type ListRes = { data?: { users?: Array<{ id: string; email?: string }> } | null; error?: unknown };
      const listRes = listResRaw as unknown as ListRes;
      const found = listRes?.data?.users?.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
      if (!found) return new Response(JSON.stringify({ error: "create_user_failed" }), { status: 500 });
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

    const { error: upsertErr } = await adminClient.from("user_profiles").upsert(profilePayload, { onConflict: "id" });
    if (upsertErr) return new Response(JSON.stringify({ error: "profile_upsert_failed", details: upsertErr }), { status: 500 });

    let inviteSent = false;
    let resetLink: string | null = null;

    // Attempt to generate a password reset link and consider it as invite email if possible
    try {
      // @ts-expect-error: generateLink may exist on admin.auth
      const linkResRaw = await adminClient.auth.admin.generateLink?.("reset", email, { redirectTo: redirectTo || process.env.SITE_URL || undefined });
      type LinkRes = { data?: { action_link?: string } | null } | null | undefined;
      const linkRes = linkResRaw as unknown as LinkRes;
      if (linkRes && linkRes.data && linkRes.data.action_link) {
        inviteSent = true;
        resetLink = linkRes.data.action_link as string;
      }
    } catch (e) {
      // ignore - best-effort
      console.warn("admin_create_user: generateLink failed", e);
    }

    // If invite not sent and invite requested, we can at least return tempPassword (admin should relay securely)

    const result: { id: string; inviteSent?: boolean; resetLink?: string | null; tempPassword?: string } = { id: userId };
    if (inviteSent) result.inviteSent = true;
    if (resetLink) result.resetLink = resetLink;
    if (!inviteSent) result.tempPassword = tempPassword;

    return new Response(JSON.stringify(result), { status: 200 });
  } catch (err) {
    console.error("admin_create_user error:", err);
    return new Response(JSON.stringify({ error: "internal", details: String(err) }), { status: 500 });
  }
}
