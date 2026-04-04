import { FRAMEWORK_CONTEXT } from "@/lib/framework";
import { loadFramework, loadBrandFramework, buildPromptContext, getLanguageInstruction } from "@/lib/framework-loader";
import { requireAuth } from "@/lib/api-auth";

export async function POST(request) {
  // const denied = await requireAuth(request); // TODO: fix auth with Supabase SSR
  // if (denied) return denied;

  const { messages, system, max_tokens, use_opus, skip_framework, project_id, brand_id } = await request.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const model = use_opus ? "claude-opus-4-20250514" : "claude-sonnet-4-20250514";

  // Build system prompt with dynamic framework context
  let enrichedSystem = system || "";
  if (!skip_framework) {
    let frameworkContext = FRAMEWORK_CONTEXT; // Default fallback
    if (brand_id || project_id) {
      try {
        const framework = brand_id
          ? await loadBrandFramework(brand_id)
          : await loadFramework(project_id);
        if (framework) {
          frameworkContext = buildPromptContext(framework);
          enrichedSystem += getLanguageInstruction(framework);
        }
      } catch (err) {
        console.error("Failed to load framework for AI route:", err);
        // Fall through to static FRAMEWORK_CONTEXT
      }
    }
    enrichedSystem = `${enrichedSystem}\n\n${frameworkContext}`;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: max_tokens || 4000, system: enrichedSystem, messages }),
    });
    const data = await response.json();
    if (!response.ok) {
      const msg = data?.error?.message || data?.error || `API error (${response.status})`;
      return Response.json({ error: typeof msg === "string" ? msg : JSON.stringify(msg) }, { status: response.status });
    }
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
