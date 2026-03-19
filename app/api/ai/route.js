import { FRAMEWORK_CONTEXT } from "@/lib/framework";

export async function POST(request) {
  const { messages, system, max_tokens, use_opus, skip_framework } = await request.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const model = use_opus ? "claude-opus-4-20250514" : "claude-sonnet-4-20250514";
  const enrichedSystem = skip_framework ? (system || "") : `${system || ""}\n\n${FRAMEWORK_CONTEXT}`;
  
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
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
