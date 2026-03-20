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
    let userId;
    const { data: userData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      // If user already exists in auth, find them and just add the role
      if (authError.message.includes("already") || authError.message.includes("registered")) {
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existing = existingUsers?.users?.find(u => u.email === email);
        if (existing) {
          userId = existing.id;
        } else {
          return Response.json({ error: authError.message }, { status: 400 });
        }
      } else {
        return Response.json({ error: authError.message }, { status: 400 });
      }
    } else {
      userId = userData.user.id;
    }

    // Add role (upsert — update if exists)
    const { error: roleError } = await adminClient.from("user_roles").upsert({
      user_id: userId,
      email,
      role,
    }, { onConflict: "user_id" });

    if (roleError) {
      // Try insert if upsert fails
      await adminClient.from("user_roles").insert({ user_id: userId, email, role });
    }

    return Response.json({
      success: true,
      user: { id: userId, email },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
