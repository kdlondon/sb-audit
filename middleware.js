import { NextResponse } from "next/server";

// In-memory rate limiting (per-instance — works for Vercel serverless)
// For production scale, use Upstash Redis instead
const rateLimitMap = new Map();

function rateLimit(ip, path, maxRequests, windowMs) {
  const key = `${ip}:${path}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.start > windowMs) {
    rateLimitMap.set(key, { start: now, count: 1 });
    return false; // Not rate limited
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return true; // Rate limited
  }
  return false;
}

// Clean up old entries periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.start > 120000) rateLimitMap.delete(key);
  }
}, 60000);

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";

  // ── CVE-2025-29927 Protection ──
  // Block requests that try to bypass middleware via x-middleware-subrequest header
  if (request.headers.get("x-middleware-subrequest")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ── Rate Limiting on API Routes ──
  if (pathname.startsWith("/api/")) {
    // Aggressive limit on AI routes (expensive — Anthropic API costs)
    if (pathname.startsWith("/api/ai") || pathname.startsWith("/api/analyze") || pathname.startsWith("/api/suggest-competitors")) {
      if (rateLimit(ip, "ai", 30, 60000)) { // 30 requests per minute
        return NextResponse.json({ error: "Rate limit exceeded. Please wait a moment." }, { status: 429 });
      }
    }

    // Strict limit on user creation
    if (pathname.startsWith("/api/create-user")) {
      if (rateLimit(ip, "create-user", 5, 60000)) { // 5 per minute
        return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
      }
    }

    // Moderate limit on YouTube routes
    if (pathname.startsWith("/api/youtube")) {
      if (rateLimit(ip, "youtube", 20, 60000)) { // 20 per minute
        return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
      }
    }

    // General API rate limit
    if (rateLimit(ip, "api-general", 100, 60000)) { // 100 per minute total
      return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
    }
  }

  // ── Security Headers ──
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export const config = {
  matcher: [
    // Match all API routes
    "/api/:path*",
    // Match all pages (for security headers)
    "/((?!_next/static|_next/image|favicon.ico|knots-dots-logo.png).*)",
  ],
};
