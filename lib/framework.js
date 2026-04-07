// Generic fallback framework context — used ONLY when a brand has no
// brand_frameworks AND no project_frameworks configured.
// The Scotiabank-specific framework now lives in brand_frameworks.framework_text
// in the database, editable from Settings > Analysis Framework > AI analysis context.

export const FRAMEWORK_CONTEXT = `
You are analyzing a competitive communication piece. No specific research framework has been configured for this brand.

Use standard marketing and communication analysis dimensions:
- Identify the communication intent (brand building, tactical, product, etc.)
- Assess the brand archetype and tone of voice
- Evaluate the execution style and creative approach
- Determine the funnel stage (awareness, consideration, conversion, retention)
- Analyze the value proposition and key messages
- Rate the overall quality and effectiveness (1-5)

Classify based on what is explicitly shown or communicated in the piece. Do not infer or assume context that is not present.
`;
