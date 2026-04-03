// Server-side auth verification for API routes
// Validates that the request comes from an authenticated Supabase user

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Verify the user is authenticated from an API route.
 * Extracts the token from the Authorization header or cookie.
 * Returns { user, error } — if error is set, return 401.
 */
export async function verifyAuth(request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { user: null, error: "Server configuration error" };
  }

  // Get token from Authorization header
  const authHeader = request.headers.get("authorization");
  let token = null;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  // Fallback: try to get from cookie
  if (!token) {
    const cookieHeader = request.headers.get("cookie") || "";
    // Supabase stores the access token in a cookie like sb-<ref>-auth-token
    const match = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/);
    if (match) {
      try {
        const decoded = decodeURIComponent(match[1]);
        const parsed = JSON.parse(decoded);
        token = parsed?.access_token || parsed?.[0]?.access_token;
      } catch {}
    }
  }

  if (!token) {
    return { user: null, error: "Not authenticated" };
  }

  // Verify the token with Supabase
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: "Invalid or expired token" };
  }

  return { user, error: null };
}

/**
 * Quick guard — returns a 401 Response if not authenticated, or null if OK.
 * Usage in API routes:
 *   const denied = await requireAuth(request);
 *   if (denied) return denied;
 */
export async function requireAuth(request) {
  const { user, error } = await verifyAuth(request);
  if (error) {
    return Response.json({ error }, { status: 401 });
  }
  return null; // Authenticated — proceed
}
