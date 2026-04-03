import { FRAMEWORK_CONTEXT } from "@/lib/framework";
import { loadFramework, buildPromptContext, getLanguageInstruction } from "@/lib/framework-loader";
import { requireAuth } from "@/lib/api-auth";

export async function POST(request) {
  // const denied = await requireAuth(request); // TODO: fix auth with Supabase SSR
  // if (denied) return denied;
  const { currentSection, reportTitle, sectionHeadings, auditSummary, knowledgeContext, project_id } = await request.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  // Load dynamic framework context
  let frameworkContext = FRAMEWORK_CONTEXT;
  let langInstruction = "";
  if (project_id) {
    try {
      const framework = await loadFramework(project_id);
      if (framework) {
        frameworkContext = buildPromptContext(framework);
        langInstruction = getLanguageInstruction(framework);
      }
    } catch (err) {
      console.error("Failed to load framework for copilot:", err);
    }
  }

  const system = `You are a research copilot assisting an analyst editing a competitive intelligence report at Knots & Dots.

${frameworkContext}

REPORT: "${reportTitle || "Untitled"}"
SECTIONS: ${sectionHeadings || "N/A"}

${knowledgeContext ? `REFERENCE DOCUMENTS:\n${knowledgeContext}\n` : ""}

Your job: read the section the analyst is currently editing and provide helpful suggestions.

Return ONLY valid JSON with this structure:
{
  "related_entries": [
    {"brand": "Brand", "description": "Campaign title", "relevance": "Why this is relevant to the current section"}
  ],
  "alternative_angles": ["A different perspective or missing point to consider"],
  "framework_connections": ["How this connects to a specific framework dimension"],
  "data_points": ["A statistical or comparative observation from the data"],
  "from_knowledge": ["A relevant reference from the uploaded documents, if any"]
}

RULES:
- Keep suggestions concise (1-2 sentences each)
- Only suggest truly relevant entries and angles
- Reference specific brands, campaigns, and data from the audit summary
- If knowledge documents are provided, reference specific findings from them
- Return 2-4 items per category, skip empty categories
- ALL output in English${langInstruction}`;

  try {
    const userMsg = `AUDIT DATA SUMMARY:\n${(auditSummary || "").slice(0, 4000)}\n\nCURRENT SECTION BEING EDITED:\n${currentSection || ""}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    try {
      return Response.json(JSON.parse(text));
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return Response.json(JSON.parse(m[0]));
      return Response.json({ related_entries: [], alternative_angles: [], framework_connections: [], data_points: [], from_knowledge: [] });
    }
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
