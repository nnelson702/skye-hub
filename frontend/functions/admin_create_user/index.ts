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
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({
          error: "missing_env",
          details: {
            SUPABASE_URL_present: !!SUPABASE_URL,
            SERVICE_ROLE_KEY_present: !!SUPABASE_SERVICE_ROLE_KEY,
            looked_for: {
              SUPABASE_URL: ["HUB_SUPABASE_URL", "SUPABASE_URL", "URL"],
              SERVICE_ROLE_KEY: [
                "HUB_SUPABASE_SERVICE_ROLE_KEY",
                "SUPABASE_SERVICE_ROLE_KEY",
                "SERVICE_ROLE_KEY",
              ],
            },
          },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Caller must be logged in (Authorization: Bearer <access_token>)
    const auth = req.headers.get("authorization") || "";
    const bearer = auth.replace(/^Bearer\s+/i, "");
    if (!bearer) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate caller + role=Admin (from your user_profiles table)
    const { data: callerData, error: callerErr } = await adminClient.auth.getUser(
      bearer
    );
    if (callerErr || !callerData?.user) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = callerData.user.id;

    const { data: profileRow, error: profileErr } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("id", callerId)
      .maybeSingle();

    if (profileErr) {
      return new Response(
        JSON.stringify({ error: "profile_lookup_failed", details: profileErr }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profileRow?.role || profileRow.role !== "Admin") {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
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

    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tempPassword = providedTempPassword || genTempPassword();

    // Create Auth user (or reuse existing)
    // @ts-expect-error admin API exists
    const createRes = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: false,
    });

    let userId: string | undefined = createRes?.data?.user?.id;

    if (!userId) {
      // @ts-expect-error admin API exists
      const listRes = await adminClient.auth.admin.listUsers();
      const found = listRes?.data?.users?.find(
        (u: any) => (u.email ?? "").toLowerCase() === String(email).toLowerCase()
      );
      if (!found?.id) {
        return new Response(
          JSON.stringify({ error: "create_user_failed", details: createRes?.error }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = found.id;
    }

    // Upsert profile
    const profilePayload = {
      id: userId,
      full_name,
      email,
      role: role || "Employee",
      status: status || "active",
      home_store_id: home_store_id || null,
      must_reset_password: true, // you wanted this ON for new users
    };

    const { error: upsertErr } = await adminClient
      .from("user_profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (upsertErr) {
      return new Response(
        JSON.stringify({ error: "profile_upsert_failed", details: upsertErr }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate reset link (best way to “invite” without creating new emails forever)
    let resetLink: string | null = null;
    try {
      const redirectTo =
        reqRedirect ??
        getEnv("HUB_REDIRECT_URL") ??
        (getEnv("HUB_SITE_URL")
          ? `${getEnv("HUB_SITE_URL")}/reset-password`
          : undefined);

      // @ts-expect-error generateLink exists
      const linkRes = await adminClient.auth.admin.generateLink("recovery", email, {
        redirectTo,
      });

      resetLink = linkRes?.data?.action_link ?? null;
    } catch {
      // ignore (still returns temp password)
    }

    return new Response(
      JSON.stringify({
        id: userId,
        resetLink,
        tempPassword: resetLink ? undefined : tempPassword,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "internal", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
