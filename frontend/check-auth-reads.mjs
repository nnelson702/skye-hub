// frontend/check-auth-reads.mjs
// Run (PowerShell):
//   $env:SUPABASE_URL="https://olbyttpwpovkvudtdoyc.supabase.co"
//   $env:SUPABASE_ANON_KEY="eyJ..."
//   node .\check-auth-reads.mjs "email@domain.com" "password"

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing env vars. Set SUPABASE_URL and SUPABASE_ANON_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

function safeError(err) {
  if (!err) return null;
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && "message" in err && typeof err.message === "string") return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function queryStoresAndProfiles(label) {
  console.log(`\n=== ${label} ===`);

  const { data: stores, error: storesErr, count: storesCount } = await supabase
    .from("stores")
    .select("id,ace_store_number,pos_store_number,store_name,status", { count: "exact" })
    .order("store_name", { ascending: true })
    .limit(10);

  console.log("stores:", {
    count: storesCount ?? (stores ? stores.length : 0),
    error: safeError(storesErr),
    sample: stores ?? [],
  });

  const { data: profiles, error: profilesErr, count: profilesCount } = await supabase
    .from("user_profiles")
    .select("id,full_name,email,role,status,home_store_id,must_reset_password", { count: "exact" })
    .order("full_name", { ascending: true })
    .limit(10);

  console.log("user_profiles:", {
    count: profilesCount ?? (profiles ? profiles.length : 0),
    error: safeError(profilesErr),
    sample: profiles ?? [],
  });
}

(async () => {
  try {
    await queryStoresAndProfiles("BEFORE SIGN IN (anon)");

    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
      console.log("\nNo credentials provided. Re-run with:");
      console.log('  node .\\check-auth-reads.mjs "email@domain.com" "password"\n');
      process.exit(0);
    }

    console.log("\nSigning in...\n");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error("signIn error:", safeError(error));
      process.exit(1);
    }

    console.log("session user id:", data?.user?.id ?? data?.session?.user?.id ?? null);

    await queryStoresAndProfiles("AFTER SIGN IN (authenticated)");

    console.log("\nDone.");
    process.exit(0);
  } catch (err) {
    console.error("Unexpected error:", safeError(err));
    process.exit(1);
  }
})();
