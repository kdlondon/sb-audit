import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  const { email, password, role, organization_id } = await request.json();

  if (!email || !password || !role) {
    return Response.json({ error: "Email, password, and role are required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Server configuration error — missing service role key" }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Create auth user
    let userId;
    const { data: userData, error: authError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes("already") || authError.message.includes("registered")) {
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existing = existingUsers?.users?.find(u => u.email === email);
        if (existing) { userId = existing.id; }
        else { return Response.json({ error: authError.message }, { status: 400 }); }
      } else {
        return Response.json({ error: authError.message }, { status: 400 });
      }
    } else {
      userId = userData.user.id;
    }

    // Map new org roles to legacy roles for backward compat
    const legacyRole = (role === "platform_admin" || role === "org_admin") ? "full_admin"
      : role === "viewer" ? "client"
      : role === "analyst" ? "analyst"
      : role; // pass through for legacy roles (full_admin, analyst, client)

    // Add to legacy user_roles (backward compat)
    const { error: roleError } = await adminClient.from("user_roles").upsert({
      user_id: userId, email, role: legacyRole,
    }, { onConflict: "user_id" });

    if (roleError) {
      await adminClient.from("user_roles").insert({ user_id: userId, email, role: legacyRole });
    }

    // Add to organization_members if organization_id provided
    if (organization_id) {
      // Determine org role: if legacy role provided, map it
      const orgRole = ["platform_admin", "org_admin", "analyst", "viewer"].includes(role) ? role
        : role === "full_admin" ? "org_admin"
        : role === "client" ? "viewer"
        : "analyst";

      await adminClient.from("organization_members").upsert({
        organization_id, user_id: userId, email, role: orgRole,
      }, { onConflict: "organization_id,user_id" });
    }

    return Response.json({ success: true, user: { id: userId, email } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
