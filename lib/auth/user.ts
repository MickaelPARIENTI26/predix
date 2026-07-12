import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/** Current authenticated user, or null. Uses getUser() (verifies the JWT with
 *  the Auth server) — never getSession(), which trusts the cookie blindly. */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Like getUser but redirects to /login when there is no session. For use at
 *  the top of protected Server Components. */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export type ProfileRow = {
  id: string;
  display_name: string;
  created_at: string;
};

/** The current user's profile row, or null if it somehow doesn't exist yet. */
export async function getProfile(): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, created_at")
    .eq("id", user.id)
    .single();

  return data;
}
