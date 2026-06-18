import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getSite(hostname: string) {
  const host = hostname.replace(/^www\./, "");

  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .or(`domain.eq.${host},domain.eq.www.${host}`)
    .single();

 if (!error && data) return data;

  // Fallback for local dev
  if (host === "localhost" || host.startsWith("localhost:")) {
    const { data: fallback } = await supabase
      .from("sites")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    return fallback;
  }

  console.error("Site lookup failed:", error);
  return null;
}