import { createClient } from "@/lib/supabase";

export const STATIC_OPTIONS = {
  competitor:["TD","RBC","BMO","CIBC","Desjardins","Amex","Venn","Float","Other"],
  category:["Traditional Banking","Credit Union","Fintech","Payment","Accounting","Tech","Non-Financial","Other"],
  year:["2000","2001","2002","2003","2004","2005","2006","2007","2008","2009","2010","2011","2012","2013","2014","2015","2016","2017","2018","2019","2020","2021","2022","2023","2024","2025","2026"],
  type:["Video","Print","Digital","Social","OOH","Website","Blog","Podcast","Event","Direct Mail","In-branch","Other"],
  entryDoor:["Freedom","Craft","Identity","Build to Exit","Multiple","None identifiable","Other"],
  portrait:["Dreamer","Builder","Sovereign","Architect","Multiple","None identifiable","Other"],
  journeyPhase:["Existential","Validation","Complexity","Consolidation","Cross-phase","Not specific","Other"],
  momentAcquisition:["Personal-to-business transition","First account setup","Digital tools config","First cash flow crisis","First LOC or credit","None","Other"],
  momentDeepening:["RM assignment/turnover","Major financing","Crisis navigation","Succession planning","Fintech adoption","None","Other"],
  momentUnexpected:["Revenue milestone","Business anniversary","Employee milestone","Peer connection","Personal life transition","None","Other"],
  clientLifecycle:["Starter","Growth","Steady","Succession","Cross-lifecycle","Not specific","Other"],
  bankRole:["Advisor","Partner","Enabler","Cheerleader","Invisible infrastructure","Community builder","Not clear","Other"],
  painPointType:["Names real problem","Aspiration territory","Product-focused only","Other"],
  languageRegister:["Owner language","Banking language","Mixed","Neither","Other"],
  channel:["Branch","Digital (web)","Digital (app)","Social media","Mass media","OOH","Direct mail","Event","Content marketing","PR","Other"],
  cta:["Visit branch","Call advisor","Use digital tool","Apply for product","Learn more","Brand only","No CTA","Other"],
  toneOfVoice:["Authoritative","Empathetic","Aspirational","Peer-level","Institutional","Playful","Urgent","Other"],
  representation:["Solo founder","Founder + team","Founder + family","Business only","Diverse mix","Corporate imagery","Other"],
  industryShown:["Construction-trades","Professional services","Food-hospitality","Retail","Tech-digital","Manufacturing","General","Other"],
  businessSize:["Micro","Core","Mid-Market","Not specified","Other"],
  brandArchetype:["Innocent","Explorer","Sage","Hero","Outlaw","Magician","Regular Guy","Lover","Jester","Caregiver","Creator","Ruler","Not identifiable","Other"],
  diffClaim:["Explicit differentiation","Implicit positioning","Interchangeable","Other"],
  executionStyle:["Testimonial","Documentary","Manifesto","Product demo","Humor","Slice of life","Animation","Data-driven","Other"],
  rating:["1","2","3","4","5"],
  funnel:["Awareness","Consideration","Conversion","Retention","Advocacy"],
  communicationIntent:["Brand Hero","Brand Tactical","Client Testimonials","Product","Innovation","Beyond Banking"],
  categoryProximity:["Direct","Adjacent","Target proximity"],
};

export async function fetchOptions(projectId) {
  const supabase = createClient();
  const query = supabase.from("dropdown_options").select("category, value, sort_order").order("sort_order", { ascending: true });
  if (projectId) query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error || !data || data.length === 0) return STATIC_OPTIONS;
  const grouped = {};
  data.forEach(row => { if (!grouped[row.category]) grouped[row.category] = []; grouped[row.category].push(row.value); });
  // Year and rating always use static options (not overridden by DB)
  delete grouped.year;
  delete grouped.rating;
  return { ...STATIC_OPTIONS, ...grouped };
}

export const COMPETITOR_COLORS = {TD:"#059669",RBC:"#2563eb",BMO:"#0ea5e9",CIBC:"#dc2626",Desjardins:"#16a34a",Amex:"#0369a1",Venn:"#7c3aed",Float:"#14b8a6",Fintech:"#7c3aed","Traditional Banking":"#475569"};

export const CATEGORY_LABELS = {competitor:"Competitors",category:"Category",year:"Year",type:"Content Type",communicationIntent:"Communication Intent",entryDoor:"Entry Door",portrait:"Portrait",journeyPhase:"Journey Phase",momentAcquisition:"Acquisition Moments",momentDeepening:"Deepening Moments",momentUnexpected:"Unexpected Moments",clientLifecycle:"Client Lifecycle",bankRole:"Bank Role",painPointType:"Pain Point Type",languageRegister:"Language Register",channel:"Channel",cta:"Call to Action",toneOfVoice:"Tone of Voice",representation:"Representation",industryShown:"Industry",businessSize:"Business Size",brandArchetype:"Brand Archetype",diffClaim:"Differentiation Claim",executionStyle:"Execution Style",rating:"Rating",funnel:"Funnel Stage",categoryProximity:"Category Proximity"};

export const SHARED_SECTIONS = [
  {title:"1. Identification",fields:[
    {key:"competitor",label:"Competitor",type:"select",localOnly:true},
    {key:"brand",label:"Brand",type:"text",globalOnly:true},
    {key:"description",label:"Title",type:"text"},
    {key:"country",label:"Country / Market",type:"text",globalOnly:true},
    {key:"category",label:"Category",type:"select"},
    {key:"category_proximity",label:"Category Proximity",type:"select",optKey:"categoryProximity",globalOnly:true},
    {key:"year",label:"Year",type:"select"},
    {key:"type",label:"Type",type:"select"},
    {key:"communication_intent",label:"Communication Intent",type:"select",optKey:"communicationIntent"},
    {key:"funnel",label:"Funnel Stage",type:"select",optKey:"funnel"},
    {key:"rating",label:"Rating (1-5)",type:"select",optKey:"rating"},
    {key:"url",label:"URL",type:"text"},
    {key:"image_url",label:"Image URL",type:"text"},
    {key:"main_slogan",label:"Main Slogan",type:"text"},
    {key:"transcript",label:"Transcript",type:"textarea"},
  ]},
  {title:"2. Creative Evaluation",fields:[
    {key:"synopsis",label:"Synopsis",type:"textarea"},
    {key:"insight",label:"Insight (human truth)",type:"textarea"},
    {key:"idea",label:"Idea (creative concept)",type:"textarea"},
    {key:"primary_territory",label:"Primary Territory",type:"text"},
    {key:"secondary_territory",label:"Secondary Territory",type:"text"},
    {key:"execution_style",label:"Execution Style",type:"select",optKey:"executionStyle"},
    {key:"analyst_comment",label:"Analyst Comment",type:"textarea"},
  ]},
  {title:"C. Entrepreneur Identity",fields:[
    {key:"entry_door",label:"Entry Door",type:"select",optKey:"entryDoor"},
    {key:"portrait",label:"Portrait",type:"select"},
  ]},
  {title:"D. Business Journey",fields:[
    {key:"journey_phase",label:"Phase",type:"select",optKey:"journeyPhase"},
    {key:"client_lifecycle",label:"Lifecycle",type:"select",optKey:"clientLifecycle"},
    {key:"moment_acquisition",label:"Acquisition Moment",type:"select",optKey:"momentAcquisition"},
    {key:"moment_deepening",label:"Deepening Moment",type:"select",optKey:"momentDeepening"},
    {key:"moment_unexpected",label:"Unexpected Moment",type:"select",optKey:"momentUnexpected"},
  ]},
  {title:"3. Brand & Communication",fields:[
    {key:"bank_role",label:"Bank Role",type:"select",optKey:"bankRole"},
    {key:"pain_point_type",label:"Pain Point Type",type:"select",optKey:"painPointType"},
    {key:"pain_point",label:"Pain Point",type:"text"},
    {key:"language_register",label:"Language Register",type:"select",optKey:"languageRegister"},
    {key:"main_vp",label:"Main VP",type:"text"},
    {key:"brand_attributes",label:"Brand Attributes",type:"text"},
    {key:"emotional_benefit",label:"Emotional Benefit",type:"text"},
    {key:"rational_benefit",label:"Rational Benefit",type:"text"},
    {key:"r2b",label:"R2B",type:"text"},
  ]},
  {title:"4. Execution",fields:[
    {key:"channel",label:"Channel",type:"select"},
    {key:"cta",label:"CTA",type:"select"},
    {key:"tone_of_voice",label:"Tone",type:"select",optKey:"toneOfVoice"},
    {key:"representation",label:"Representation",type:"select"},
    {key:"industry_shown",label:"Industry",type:"select",optKey:"industryShown"},
    {key:"business_size",label:"Size",type:"select",optKey:"businessSize"},
    {key:"brand_archetype",label:"Archetype",type:"select",optKey:"brandArchetype"},
    {key:"diff_claim",label:"Differentiation",type:"select",optKey:"diffClaim"},
  ]},
];

export function getFieldsForScope(scope) {
  return SHARED_SECTIONS.map(sec => ({...sec,fields:sec.fields.filter(f=>{if(scope==="local"&&f.globalOnly)return false;if(scope==="global"&&f.localOnly)return false;return true;})})).filter(sec=>sec.fields.length>0);
}

/**
 * Get sections filtered by framework configuration.
 * Hides Section C (Entrepreneur Identity) and D (Business Journey) for non-specialist frameworks.
 * Hides individual fields based on standard dimension toggles.
 * Adds custom dimensions as additional fields.
 * @param {object} framework - Framework object from useFramework()
 * @param {string} scope - "local" or "global"
 * @returns {Array} Filtered sections array
 */
export function getSections(framework, scope) {
  // Start with scope-filtered sections
  let sections = getFieldsForScope(scope);

  // If no framework loaded, return all sections (backward compat)
  if (!framework || !framework.tier) return sections;

  const hasDim = (key) => framework.dimensions?.some(d => d.key === key);
  const stdDims = framework.standardDimensions || [];

  // Filter out hidden sections based on tier/framework
  sections = sections.filter(sec => {
    // Section C: only show if framework has portrait/entry_door dimensions
    if (sec.title === "C. Entrepreneur Identity") {
      return hasDim("portrait") || hasDim("entry_door") || hasDim("richness_definition") || hasDim("experience_reflected");
    }
    // Section D: only show if framework has journey/lifecycle dimensions
    if (sec.title === "D. Business Journey") {
      return hasDim("journey_phase") || hasDim("client_lifecycle") || hasDim("moment_acquisition") || hasDim("moment_deepening") || hasDim("moment_unexpected");
    }
    return true;
  });

  // Filter out hidden fields based on standard dimension toggles
  const hiddenFields = [];
  if (!stdDims.includes("archetype")) hiddenFields.push("brand_archetype");
  if (!stdDims.includes("tone")) hiddenFields.push("tone_of_voice");
  if (!stdDims.includes("execution")) hiddenFields.push("execution_style");
  if (!stdDims.includes("funnel")) hiddenFields.push("funnel");
  if (!stdDims.includes("rating")) hiddenFields.push("rating");

  // Hide bank-specific fields for non-banking industries
  if (!hasDim("bank_role") && framework.industry !== "Banking & Financial Services") {
    hiddenFields.push("bank_role");
    hiddenFields.push("language_register");
  }

  if (hiddenFields.length > 0) {
    sections = sections.map(sec => ({
      ...sec,
      fields: sec.fields.filter(f => !hiddenFields.includes(f.key))
    })).filter(sec => sec.fields.length > 0);
  }

  // Update communication_intent options from framework
  if (framework.communicationIntents?.length > 0) {
    sections = sections.map(sec => ({
      ...sec,
      fields: sec.fields.map(f => {
        if (f.optKey === "communicationIntent" || f.key === "communication_intent") {
          return { ...f, _frameworkValues: framework.communicationIntents };
        }
        return f;
      })
    }));
  }

  // Update brand category options from framework
  if (framework.brandCategories?.length > 0) {
    sections = sections.map(sec => ({
      ...sec,
      fields: sec.fields.map(f => {
        if (f.key === "category") {
          return { ...f, _frameworkValues: framework.brandCategories };
        }
        return f;
      })
    }));
  }

  // Update competitor list from framework
  if (framework.localCompetitors?.length > 0) {
    const competitorNames = framework.localCompetitors.map(c => typeof c === "string" ? c : c.name).filter(Boolean);
    if (competitorNames.length > 0) {
      sections = sections.map(sec => ({
        ...sec,
        fields: sec.fields.map(f => {
          if (f.key === "competitor") {
            return { ...f, _frameworkValues: [...competitorNames, "Other"] };
          }
          return f;
        })
      }));
    }
  }

  return sections;
}

/**
 * Get options for a field, respecting framework overrides.
 * If a field has _frameworkValues, use those instead of static/DB options.
 */
export function getFieldOptions(field, options) {
  if (field._frameworkValues) return field._frameworkValues;
  const optKey = field.optKey || field.key;
  return options[optKey] || [];
}

// [PHASE 0] Now reads from unified creative_source table
export function getTableName(scope) { return "creative_source"; }

// Legacy function — kept for backward compat during transition
export function getLegacyTableName(scope) { return scope === "global" ? "audit_global" : "audit_entries"; }
