#!/usr/bin/env node
/**
 * Seed script for staging environment.
 * Creates sample projects, frameworks, and test data.
 * Idempotent — safe to re-run (upserts or deletes+recreates).
 *
 * Usage: SUPABASE_URL=xxx SUPABASE_KEY=xxx node scripts/seed-staging.js
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEMO_PROJECTS = [
  {
    id: "proj_demo_retail",
    name: "Allbirds Competitive Audit",
    client_name: "Allbirds",
    description: "Sustainable footwear competitive intelligence (Tier 1 — Essential)",
  },
  {
    id: "proj_demo_fintech",
    name: "Revolut Competitive Audit",
    client_name: "Revolut",
    description: "Fintech competitive intelligence with custom dimensions (Tier 2 — Enhanced)",
  },
];

const DEMO_FRAMEWORKS = [
  {
    project_id: "proj_demo_retail",
    name: "Allbirds Essential Framework",
    tier: "essential",
    brand_name: "Allbirds",
    brand_description: "Sustainable footwear brand using natural materials like merino wool and eucalyptus tree fiber.",
    brand_positioning: "Comfort meets sustainability — the world's most comfortable shoes made from nature.",
    brand_differentiator: "First major footwear brand built entirely on natural, renewable materials.",
    brand_audience: "Environmentally conscious urban professionals, 25-45, who value quality and sustainability.",
    brand_tone: "Warm, Playful, Purpose-driven",
    industry: "Fashion & Apparel",
    sub_category: "Sustainable Footwear",
    primary_market: "US",
    global_markets: ["GB", "AU", "DE", "JP"],
    language: "English",
    objectives: ["Understand competitive positioning and messaging", "Find creative inspiration from global brands", "Identify white spaces and opportunities"],
    communication_intents: ["Brand Hero", "Brand Tactical", "Product", "Innovation", "Sustainability"],
    standard_dimensions: ["archetype", "tone", "execution", "funnel", "rating"],
    brand_categories: ["Leader", "Challenger", "Niche", "Emerging", "Other"],
    local_competitors: [
      { name: "Nike", type: "direct" },
      { name: "Adidas", type: "direct" },
      { name: "New Balance", type: "direct" },
      { name: "On Running", type: "direct" },
      { name: "Veja", type: "adjacent" },
      { name: "Rothy's", type: "adjacent" },
    ],
    global_benchmarks: [
      { name: "Patagonia", country: "US", industry: "Outdoor Apparel" },
      { name: "Everlane", country: "US", industry: "Fashion" },
      { name: "IKEA", country: "SE", industry: "Home Furnishing" },
    ],
    dimensions: [],
  },
  {
    project_id: "proj_demo_fintech",
    name: "Revolut Enhanced Framework",
    tier: "enhanced",
    brand_name: "Revolut",
    brand_description: "Global fintech super-app offering banking, crypto, trading, and international transfers.",
    brand_positioning: "One app for all things money — designed for a borderless world.",
    brand_differentiator: "Super-app approach combining banking, trading, crypto, and lifestyle in one platform.",
    brand_audience: "Digital-native millennials and Gen Z, frequent travelers, crypto-curious professionals.",
    brand_tone: "Bold, Innovative, Minimal",
    industry: "Fintech",
    sub_category: "Neobank / Super-app",
    primary_market: "GB",
    global_markets: ["US", "DE", "FR", "ES", "AU"],
    language: "English",
    objectives: ["Understand competitive positioning and messaging", "Track campaign activity and new launches", "Benchmark communication quality and consistency"],
    communication_intents: ["Brand Hero", "Brand Tactical", "Product", "Innovation", "Growth"],
    standard_dimensions: ["archetype", "tone", "execution", "funnel", "rating"],
    brand_categories: ["Neobank", "Traditional Bank", "Fintech", "Crypto", "Other"],
    local_competitors: [
      { name: "Monzo", type: "direct" },
      { name: "Starling", type: "direct" },
      { name: "N26", type: "direct" },
      { name: "Wise", type: "direct" },
      { name: "Barclays", type: "adjacent" },
      { name: "Chase UK", type: "adjacent" },
    ],
    global_benchmarks: [
      { name: "Nubank", country: "BR", industry: "Fintech" },
      { name: "Cash App", country: "US", industry: "Fintech" },
      { name: "Grab", country: "SG", industry: "Super-app" },
    ],
    dimensions: [
      {
        name: "User Persona",
        key: "user_persona",
        values: ["Digital Native", "Globetrotter", "Crypto Curious", "Budget Optimizer", "Premium Seeker"],
        description: "Target user archetype based on primary use case and lifestyle",
      },
      {
        name: "Product Focus",
        key: "product_focus",
        values: ["Banking", "Trading", "Crypto", "Transfers", "Lifestyle", "Multi-product"],
        description: "Which product vertical the communication primarily promotes",
      },
    ],
  },
];

async function seed() {
  console.log("Seeding staging environment...\n");

  // 1. Upsert projects
  for (const proj of DEMO_PROJECTS) {
    const { error } = await supabase.from("projects").upsert(proj, { onConflict: "id" });
    if (error) console.error(`  Error upserting project ${proj.id}:`, error.message);
    else console.log(`  Project: ${proj.name}`);
  }

  // 2. Upsert frameworks
  for (const fw of DEMO_FRAMEWORKS) {
    // Delete existing first (upsert on project_id)
    await supabase.from("project_frameworks").delete().eq("project_id", fw.project_id);
    const { error } = await supabase.from("project_frameworks").insert(fw);
    if (error) console.error(`  Error inserting framework for ${fw.project_id}:`, error.message);
    else console.log(`  Framework: ${fw.name} (${fw.tier})`);
  }

  // 3. Insert dropdown options for each project
  for (const fw of DEMO_FRAMEWORKS) {
    await supabase.from("dropdown_options").delete().eq("project_id", fw.project_id);
    const competitors = fw.local_competitors.map(c => c.name);
    const opts = [
      ...competitors.map((v, i) => ({ project_id: fw.project_id, category: "competitor", value: v, sort_order: i })),
      ...fw.communication_intents.map((v, i) => ({ project_id: fw.project_id, category: "communicationIntent", value: v, sort_order: i })),
      ...fw.brand_categories.map((v, i) => ({ project_id: fw.project_id, category: "category", value: v, sort_order: i })),
    ];
    const { error } = await supabase.from("dropdown_options").insert(opts);
    if (error) console.error(`  Error inserting options for ${fw.project_id}:`, error.message);
    else console.log(`  Options: ${opts.length} dropdown values for ${fw.project_id}`);
  }

  console.log("\nStaging seed complete.");
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
