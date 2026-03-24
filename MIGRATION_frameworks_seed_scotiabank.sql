-- SEED: Migrate existing Scotiabank project into project_frameworks
-- Run AFTER MIGRATION_frameworks.sql
-- Uses the existing project ID 'proj_sb_bb' (Scotiabank Business Banking)

INSERT INTO project_frameworks (
  project_id,
  name,
  tier,
  brand_name,
  brand_description,
  brand_positioning,
  brand_differentiator,
  brand_audience,
  brand_tone,
  industry,
  sub_category,
  primary_market,
  global_markets,
  language,
  objectives,
  brand_categories,
  communication_intents,
  standard_dimensions,
  dimensions,
  framework_text
) VALUES (
  'proj_sb_bb',
  'Scotiabank SME Framework',
  'specialist',
  'Scotiabank',
  'Scotiabank Business Banking — serving Canadian SME owners with banking products, advisory services, and financial tools.',
  'A bank that understands the entrepreneurial journey and positions itself as a partner, not just a service provider.',
  'Deep understanding of SME owner identity types (Dreamers, Builders, Sovereigns, Architects) from proprietary research with 84 synthetic + 32 real interviews.',
  'Canadian SME owners — from micro-businesses to mid-market enterprises, across all stages of the entrepreneurial journey.',
  'Empathetic, Aspirational, Peer-level',
  'Banking & Financial Services',
  'Business Banking / SME',
  'CA',
  '["US","GB","AU","MX"]',
  'English',
  '["Understand competitive positioning and messaging","Track campaign activity and new launches","Identify white spaces and opportunities","Benchmark communication quality and consistency"]',
  '["Traditional Banking","Fintech","Neobank","Credit Union","Supplementary Services","Non-financial"]',
  '["Brand Hero","Brand Tactical","Client Testimonials","Product","Innovation","Beyond Banking"]',
  '["archetype","tone","execution","funnel","rating"]',
  '[
    {
      "name": "Portrait",
      "key": "portrait",
      "values": ["Dreamer","Builder","Sovereign","Architect"],
      "description": "Owner identity types from SME research — Dreamer (early-stage survival), Builder (identity fused with business), Sovereign (autonomy-focused), Architect (strategic operator)",
      "classification_rules": "Base on IMPLIED audience, not actual product. Solo founder overwhelmed = Dreamer even if brand is a big bank. If purely product-focused with no owner narrative = None identifiable."
    },
    {
      "name": "Entry Door",
      "key": "entry_door",
      "values": ["Freedom","Craft","Identity","Build to Exit"],
      "description": "Why they started — Freedom (left corporate for autonomy), Craft (bet on talent), Identity (legacy/personal proof), Build to Exit (strategic value creation)",
      "classification_rules": "Base on MOTIVATION shown or implied in the piece."
    },
    {
      "name": "Journey Phase",
      "key": "journey_phase",
      "values": ["Existential","Validation","Complexity","Consolidation"],
      "description": "Business journey stage — Existential (survival 0-2yr), Validation (proving viability 1-4yr), Complexity (scale beyond self 3-10yr), Consolidation (sustainable shape 8+yr)",
      "classification_rules": "Base on BUSINESS STAGE depicted, not the brands target market."
    },
    {
      "name": "Experience Reflected",
      "key": "experience_reflected",
      "values": ["Existential struggle","Validation seeking","Complexity navigation","Consolidation choice","General entrepreneurship"],
      "description": "Which journey experience is reflected in the communication"
    },
    {
      "name": "Richness Definition",
      "key": "richness_definition",
      "values": ["Potential","Impact","Life well-designed","Strategic capability","Financial (default)"],
      "description": "How richness is experienced — MUST match portrait: Dreamer=Potential, Builder=Impact, Sovereign=Life well-designed, Architect=Strategic capability",
      "classification_rules": "Must align with portrait assignment."
    },
    {
      "name": "Client Lifecycle",
      "key": "client_lifecycle",
      "values": ["Starter","Growth","Steady","Succession"],
      "description": "Scotiabank lifecycle segmentation — Starter (micro, first 3yr), Growth (ambitious $500K-$5M), Steady (optimizers), Succession (mature/transition)"
    },
    {
      "name": "Acquisition Moment",
      "key": "moment_acquisition",
      "values": ["Personal-to-business transition","First account setup","Digital tools config","First cash flow crisis","First LOC or credit"],
      "description": "How the bank acquires the customer — only assign if piece specifically addresses this moment"
    },
    {
      "name": "Deepening Moment",
      "key": "moment_deepening",
      "values": ["RM assignment/turnover","Major financing","Crisis navigation","Succession planning","Fintech adoption"],
      "description": "How the bank relationship strengthens or breaks"
    },
    {
      "name": "Unexpected Moment",
      "key": "moment_unexpected",
      "values": ["Revenue milestone","Business anniversary","Employee milestone","Peer connection","Personal life transition"],
      "description": "Opportunity moments no bank currently captures"
    },
    {
      "name": "Bank Role",
      "key": "bank_role",
      "values": ["Advisor","Partner","Enabler","Cheerleader","Invisible infrastructure","Community builder"],
      "description": "How the bank positions itself in the communication"
    },
    {
      "name": "Language Register",
      "key": "language_register",
      "values": ["Owner language","Banking language","Mixed","Neither"],
      "description": "Whether the piece speaks in the owners language or institutional banking language"
    },
    {
      "name": "Pain Point Type",
      "key": "pain_point_type",
      "values": ["Names real problem","Aspiration territory","Product-focused only"],
      "description": "How the piece addresses pain points"
    }
  ]',
  E'=== SCOTIABANK BUSINESS BANKING — RESEARCH FRAMEWORKS ===\n\nYou are classifying competitive communications against these specific research frameworks developed from 84 synthetic + 32 real interviews with Canadian SME owners. Every classification MUST align with these definitions.\n\n--- FOUR PORTRAITS (Owner Identity Types) ---\n\nDREAMER: Early-stage founders still in survival/potential mode. Business is a bet they haven''t fully validated. They''re the "Chief Everything Officer" — doing everything themselves. Motivation is possibility and proving the idea can work. Richness = potential, a returning client, a testimonial they didn''t ask for. Bank relationship: transactional, the bank is where money passes through. Typical: under $500K revenue, 1-3 years, solo or tiny team.\n\nBUILDER: Identity is fused with the business — "I feel useless in life if I do not have this business." Business defines who they are as a person. Motivated by impact on community, employees, students, clients. Watches every employee grow. Still does the books personally because "the numbers are where I feel the pulse." Richness = people, relationships, community, respect — never money itself. May be on Growth or Steady trajectory. Typical: $500K-$5M, 5-15+ years, team of 5-50.\n\nSOVEREIGN: Business is a vehicle for a life well-designed. The goal is autonomy, not scale. Said no to partnerships that would double revenue without hesitation. Measures richness by how rarely they worry — "peace of mind, full stop." Doesn''t want growth, wants sustainability and freedom. Tuesday morning walk, long lunch. Typical: $500K-$2M, 10+ years, deliberately small team or solo with part-time help.\n\nARCHITECT: Strategic operator who loves the building process, not the business itself. "I''m just a scaler at heart." May have sold businesses before. Sees business as a system to optimize and exit. Richness = optionality — three deals on the table and capital to move fast. Bank relationship is purely instrumental — chose for tools and lending terms, evaluating alternatives constantly. Typical: $2M-$15M+ portfolio, serial entrepreneur.\n\n--- FOUR ENTRY DOORS (Why They Started) ---\n\nFREEDOM ("I own my time"): Left corporate to control their schedule, decisions, pace. Autonomy was the primary driver. After Validation, may evolve into Sovereign (if autonomy was the true goal) or Builder (if they discovered deeper meaning).\n\nCRAFT ("I bet on my talent"): Started because they''re excellent at something — design, cooking, coding, fitness. Passion-led entry. Over time, running the business changes the meaning: "something I love doing" becomes "something that defines who I am." Most likely to become Builders.\n\nIDENTITY ("My name is on this"): Started to build something with their name, create a legacy, prove something — to family, to themselves, to their community. "I''ll show them." Deepens into Builder territory naturally. The business IS the identity from day one.\n\nBUILD TO EXIT ("I play to win"): Strategic entry — saw an opportunity, built to create value, plans to sell or repeat. Money is the scoreboard but the game is what drives them. Almost always becomes Architect. May be on their 2nd or 3rd business.\n\n--- BUSINESS JOURNEY PHASES ---\n\nEXISTENTIAL ("Can this exist?"): Pure survival. Every business starts here. The Dreamer lives here. Cash flow is day-to-day. Owner doesn''t know what they don''t know. Teaching themselves through YouTube and Google. Bank is invisible or unhelpful at this stage. Duration: 0-2 years typically.\n\nVALIDATION ("Can this work?"): Fragile base forming. Revenue is coming but inconsistent. First hires, first real clients, first process. The owner starts to see it might actually work. Still loops back to Existential when a client payment is late. This is where the bank relationship is first truly tested — first LOC, first real conversation. Duration: 1-4 years.\n\nCOMPLEXITY ("Can this scale beyond me?"): The business needs to work without the owner doing everything. Hiring, delegating, systems, leadership. For Builders, this is identity-defining: "this business consumes my whole life." For Architects, this is a system to solve. Major financing decisions happen here. RM relationship is critical. Duration: 3-10+ years.\n\nCONSOLIDATION ("Can this sustain what I''ve built?"): The owner has found a sustainable shape. For Sovereigns, this is the destination — the equation is solved. For Builders who chose depth over scale, it''s about nurturing quality. Most deliberate phase. Succession questions emerge. Duration: 8+ years.\n\n--- MOMENTS THAT MATTER ---\n\nACQUISITION MOMENTS (how the bank gets the customer):\n- Personal-to-business account transition: 77% default to personal bank. Sets relationship template forever.\n- First business account setup: Owner alone, overwhelmed, wants a box checked.\n- Digital tools config: Tools don''t integrate, manual workarounds, first time fintech appears on radar.\n- First cash flow crisis: Client delays payment, payroll due, 45 minutes on hold.\n- First LOC or credit: First formal evaluation. Deeply personal for Builders. Banks that see trajectory earn loyalty.\n\nDEEPENING MOMENTS (how the relationship strengthens or breaks):\n- RM assignment/turnover: Assignment = cautious hope. Turnover = resignation. Highest leverage moment.\n- Major financing: Largest commitment. Personal guarantees. Feeling treated as risk case vs growth story.\n- Crisis navigation: Lost contract, pandemic, client default. Owner needs partner, not procedure.\n- Succession planning: Bank completely absent. Owner uncertain, alone in unfamiliar domain.\n- Fintech adoption: Pragmatic, not angry. Bank didn''t fail — just didn''t keep up. Leading indicator of defection.\n\nUNEXPECTED MOMENTS (opportunities no bank currently captures):\n- Revenue milestone: Bank has data, sees threshold crossed. No one celebrates it.\n- Business anniversary: Nobody marks it. 15 years, 22 staff, bank never acknowledged.\n- Employee milestone: Payroll grew from 3 to 18. Bank sees the data, never uses it.\n- Peer connection: Most enriching relationships are with peers, not advisors. Bank as connector.\n- Personal life transition: Separation, illness. Bank trained to separate personal/business but for owners there IS no separation.\n\n--- CLIENT LIFECYCLE SEGMENTATION (Scotiabank''s existing framework) ---\n\nSTARTER: Micro businesses, first 3 years, revenue under $500K. Pre-Core, trying to break through.\nGROWTH: Ambitious builders/architects actively scaling. Revenue $500K-$5M. Core segment.\nSTEADY: Strategic optimizers nurturing quality over expansion. Revenue $500K-$5M. Core segment.\nSUCCESSION: Mature businesses considering transition, sale, or next generation. Revenue varies.\n\n--- RICHNESS DEFINITIONS (how "rich" is experienced at each stage) ---\n\nPOTENTIAL: Richness is survival and validation — proof the idea works. (Dreamer)\nIMPACT: Richness is people, relationships, community, seeing your team grow. (Builder)\nLIFE WELL-DESIGNED: Richness is peace of mind, absence of threat, rarely worrying. (Sovereign)\nSTRATEGIC CAPABILITY: Richness is optionality — deals on table, capital to act. (Architect)\nFINANCIAL (DEFAULT): Traditional financial metrics — revenue, profit, assets. (Generic/unspecified)\n\n--- CLASSIFICATION RULES ---\n\n1. Portrait assignment should be based on the IMPLIED audience, not the actual product. A piece showing a solo founder overwhelmed = Dreamer, even if the brand is a big bank.\n2. Entry door should be based on the MOTIVATION shown or implied in the piece.\n3. Journey phase should be based on the BUSINESS STAGE depicted, not the brand''s target market.\n4. Moments should only be assigned if the piece specifically addresses that moment. Most pieces will be "None."\n5. If a piece is purely product-focused with no owner narrative, portrait and entry door should be "None identifiable."\n6. Richness definition should match the portrait assignment: Dreamer=Potential, Builder=Impact, Sovereign=Life well-designed, Architect=Strategic capability.'
) ON CONFLICT (project_id) DO UPDATE SET
  name = EXCLUDED.name,
  tier = EXCLUDED.tier,
  brand_name = EXCLUDED.brand_name,
  brand_description = EXCLUDED.brand_description,
  brand_positioning = EXCLUDED.brand_positioning,
  brand_differentiator = EXCLUDED.brand_differentiator,
  brand_audience = EXCLUDED.brand_audience,
  brand_tone = EXCLUDED.brand_tone,
  industry = EXCLUDED.industry,
  sub_category = EXCLUDED.sub_category,
  primary_market = EXCLUDED.primary_market,
  global_markets = EXCLUDED.global_markets,
  language = EXCLUDED.language,
  objectives = EXCLUDED.objectives,
  brand_categories = EXCLUDED.brand_categories,
  communication_intents = EXCLUDED.communication_intents,
  standard_dimensions = EXCLUDED.standard_dimensions,
  dimensions = EXCLUDED.dimensions,
  framework_text = EXCLUDED.framework_text,
  updated_at = now();
