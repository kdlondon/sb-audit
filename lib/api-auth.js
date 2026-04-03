// Server-side auth verification for API routes
// Validates that the request comes from an authenticated Supabase user

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Verify the user is authenticated from an API route.
 * Extracts the token from the Authorization header or Supabase cookies.
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

  // Fallback: try to get from Supabase cookies
  if (!token) {
    const cookieHeader = request.headers.get("cookie") || "";

    // Supabase SSR stores tokens in chunked cookies:
    // sb-<ref>-auth-token.0, sb-<ref>-auth-token.1, etc.
    // Or as a single sb-<ref>-auth-token cookie
    const ref = (supabaseUrl || "").match(/\/\/([^.]+)/)?.[1] || "";
    const prefix = `sb-${ref}-auth-token`;

    // Try single cookie first
    const singleMatch = cookieHeader.match(new RegExp(`${prefix}=([^;]+)`));
    if (singleMatch) {
      try {
        const decoded = decodeURIComponent(singleMatch[1]);
        // Could be JSON string or base64
        if (decoded.startsWith("[") || decoded.startsWith("{")) {
          const parsed = JSON.parse(decoded);
          token = Array.isArray(parsed) ? parsed[0]?.access_token : parsed?.access_token;
        } else {
          token = decoded;
        }
      } catch {}
    }

    // Try chunked cookies (sb-xxx-auth-token.0, .1, .2...)
    if (!token) {
      let chunks = "";
      for (let i = 0; i < 10; i++) {
        const chunkMatch = cookieHeader.match(new RegExp(`${prefix}\\.${i}=([^;]+)`));
        if (chunkMatch) chunks += decodeURIComponent(chunkMatch[1]);
        else break;
      }
      if (chunks) {
        try {
          // Chunked cookies form a base64-encoded JSON string
          const decoded = chunks.startsWith("base64-") ? atob(chunks.slice(7)) : chunks;
          if (decoded.startsWith("[") || decoded.startsWith("{")) {
            const parsed = JSON.parse(decoded);
            token = Array.isArray(parsed) ? parsed[0]?.access_token : parsed?.access_token;
          }
        } catch {}
      }
    }

    // Last resort: try any cookie that looks like a JWT
    if (!token) {
      const allCookies = cookieHeader.split(";").map(c => c.trim());
      for (const cookie of allCookies) {
        const [name, ...valueParts] = cookie.split("=");
        const value = valueParts.join("=");
        if (name.includes("auth-token") && value) {
          try {
            const decoded = decodeURIComponent(value);
            if (decoded.startsWith("ey")) {
              token = decoded; // Looks like a JWT
              break;
            }
            const parsed = JSON.parse(decoded);
            const t = Array.isArray(parsed) ? parsed[0]?.access_token : parsed?.access_token;
            if (t) { token = t; break; }
          } catch {}
        }
      }
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
 */
export async function requireAuth(request) {
  const { user, error } = await verifyAuth(request);
  if (error) {
    return Response.json({ error }, { status: 401 });
  }
  return null;
}
