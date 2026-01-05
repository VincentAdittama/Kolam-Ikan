import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

export default async function handler(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return new Response("Missing environment variables", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Simple query to wake up the database
  const { data, error } = await supabase
    .from("users")
    .select("count")
    .limit(1)
    .single();

  if (error) {
    // It's okay if 'users' table doesn't exist or is empty, we just want to hit the DB.
    // If the error is connection related, that's what we want to know.
    console.error("Supabase ping error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ message: "Pong", data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
