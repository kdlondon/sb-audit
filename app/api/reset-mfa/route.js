import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  const { user_id } = await request.json();

  if (!user_id) {
    return Response.json({ error: "user_id is required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // List all MFA factors for the user
    const { data, error: listError } = await adminClient.auth.admin.mfa.listFactors({ userId: user_id });

    if (listError) {
      return Response.json({ error: listError.message }, { status: 400 });
    }

    const factors = [...(data?.totp || []), ...(data?.phone || [])];

    if (factors.length === 0) {
      return Response.json({ success: true, message: "No MFA factors found", removed: 0 });
    }

    // Delete all factors
    let removed = 0;
    for (const factor of factors) {
      const { error: delError } = await adminClient.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: user_id,
      });
      if (!delError) removed++;
    }

    // Also clear email MFA metadata
    await adminClient.auth.admin.updateUser(user_id, {
      user_metadata: { mfa_email_enabled: false },
    });

    return Response.json({ success: true, removed });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
