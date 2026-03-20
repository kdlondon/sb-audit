import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  const { email, password, role } = await request.json();

  if (!email || !password || !role) {
    return Response.json({ error: "Email, password, and role are required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Server configuration error — missing service role key" }, { status: 500 });
  }

  // Use service role client to create user without affecting current session
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Create auth user
    const { data: userData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email verification
    });

    if (authError) {
      return Response.json({ error: authError.message }, { status: 400 });
    }

    // Add role
    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: userData.user.id,
      email,
      role,
    });

    if (roleError) {
      return Response.json({ error: "User created but role assignment failed: " + roleError.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      user: { id: userData.user.id, email },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
