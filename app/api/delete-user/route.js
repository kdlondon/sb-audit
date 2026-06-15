import { createClient } from "@supabase/supabase-js";

// Fully remove a user: auth account + all membership/access rows.
// Without deleting the auth account, the user can still log in (the bug this fixes).
export async function POST(request) {
  const { user_id } = await request.json();
  if (!user_id) return Response.json({ error: "user_id is required" }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Server configuration error — missing service role key" }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Remove access/membership rows (both legacy and new systems)
    await admin.from("project_access").delete().eq("user_id", user_id);
    await admin.from("user_roles").delete().eq("user_id", user_id);
    await admin.from("organization_members").delete().eq("user_id", user_id);

    // 2. Delete the auth account — this is what actually revokes login
    const { error: delError } = await admin.auth.admin.deleteUser(user_id);
    if (delError) {
      return Response.json({ error: `Removed access but couldn't delete the login account: ${delError.message}` }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
