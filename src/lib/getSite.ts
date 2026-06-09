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

  if (error) {
    console.error("Site lookup failed:", error);
    return null;
  }

  return data;
}