// Framework context injected into all AI prompts for accurate classification
// This encodes the Scotiabank Business Banking research frameworks

export const FRAMEWORK_CONTEXT = `
=== SCOTIABANK BUSINESS BANKING — RESEARCH FRAMEWORKS ===

You are classifying competitive communications against these specific research frameworks developed from 84 synthetic + 32 real interviews with Canadian SME owners. Every classification MUST align with these definitions.

--- FOUR PORTRAITS (Owner Identity Types) ---

DREAMER: Early-stage founders still in survival/potential mode. Business is a bet they haven't fully validated. They're the "Chief Everything Officer" — doing everything themselves. Motivation is possibility and proving the idea can work. Richness = potential, a returning client, a testimonial they didn't ask for. Bank relationship: transactional, the bank is where money passes through. Typical: under $500K revenue, 1-3 years, solo or tiny team.

BUILDER: Identity is fused with the business — "I feel useless in life if I do not have this business." Business defines who they are as a person. Motivated by impact on community, employees, students, clients. Watches every employee grow. Still does the books personally because "the numbers are where I feel the pulse." Richness = people, relationships, community, respect — never money itself. May be on Growth or Steady trajectory. Typical: $500K-$5M, 5-15+ years, team of 5-50.

SOVEREIGN: Business is a vehicle for a life well-designed. The goal is autonomy, not scale. Said no to partnerships that would double revenue without hesitation. Measures richness by how rarely they worry — "peace of mind, full stop." Doesn't want growth, wants sustainability and freedom. Tuesday morning walk, long lunch. Typical: $500K-$2M, 10+ years, deliberately small team or solo with part-time help.

ARCHITECT: Strategic operator who loves the building process, not the business itself. "I'm just a scaler at heart." May have sold businesses before. Sees business as a system to optimize and exit. Richness = optionality — three deals on the table and capital to move fast. Bank relationship is purely instrumental — chose for tools and lending terms, evaluating alternatives constantly. Typical: $2M-$15M+ portfolio, serial entrepreneur.

--- FOUR ENTRY DOORS (Why They Started) ---

FREEDOM ("I own my time"): Left corporate to control their schedule, decisions, pace. Autonomy was the primary driver. After Validation, may evolve into Sovereign (if autonomy was the true goal) or Builder (if they discovered deeper meaning).

CRAFT ("I bet on my talent"): Started because they're excellent at something — design, cooking, coding, fitness. Passion-led entry. Over time, running the business changes the meaning: "something I love doing" becomes "something that defines who I am." Most likely to become Builders.

IDENTITY ("My name is on this"): Started to build something with their name, create a legacy, prove something — to family, to themselves, to their community. "I'll show them." Deepens into Builder territory naturally. The business IS the identity from day one.

BUILD TO EXIT ("I play to win"): Strategic entry — saw an opportunity, built to create value, plans to sell or repeat. Money is the scoreboard but the game is what drives them. Almost always becomes Architect. May be on their 2nd or 3rd business.

--- BUSINESS JOURNEY PHASES ---

EXISTENTIAL ("Can this exist?"): Pure survival. Every business starts here. The Dreamer lives here. Cash flow is day-to-day. Owner doesn't know what they don't know. Teaching themselves through YouTube and Google. Bank is invisible or unhelpful at this stage. Duration: 0-2 years typically.

VALIDATION ("Can this work?"): Fragile base forming. Revenue is coming but inconsistent. First hires, first real clients, first process. The owner starts to see it might actually work. Still loops back to Existential when a client payment is late. This is where the bank relationship is first truly tested — first LOC, first real conversation. Duration: 1-4 years.

COMPLEXITY ("Can this scale beyond me?"): The business needs to work without the owner doing everything. Hiring, delegating, systems, leadership. For Builders, this is identity-defining: "this business consumes my whole life." For Architects, this is a system to solve. Major financing decisions happen here. RM relationship is critical. Duration: 3-10+ years.

CONSOLIDATION ("Can this sustain what I've built?"): The owner has found a sustainable shape. For Sovereigns, this is the destination — the equation is solved. For Builders who chose depth over scale, it's about nurturing quality. Most deliberate phase. Succession questions emerge. Duration: 8+ years.

--- MOMENTS THAT MATTER ---

ACQUISITION MOMENTS (how the bank gets the customer):
- Personal-to-business account transition: 77% default to personal bank. Sets relationship template forever.
- First business account setup: Owner alone, overwhelmed, wants a box checked.
- Digital tools config: Tools don't integrate, manual workarounds, first time fintech appears on radar.
- First cash flow crisis: Client delays payment, payroll due, 45 minutes on hold.
- First LOC or credit: First formal evaluation. Deeply personal for Builders. Banks that see trajectory earn loyalty.

DEEPENING MOMENTS (how the relationship strengthens or breaks):
- RM assignment/turnover: Assignment = cautious hope. Turnover = resignation. Highest leverage moment.
- Major financing: Largest commitment. Personal guarantees. Feeling treated as risk case vs growth story.
- Crisis navigation: Lost contract, pandemic, client default. Owner needs partner, not procedure.
- Succession planning: Bank completely absent. Owner uncertain, alone in unfamiliar domain.
- Fintech adoption: Pragmatic, not angry. Bank didn't fail — just didn't keep up. Leading indicator of defection.

UNEXPECTED MOMENTS (opportunities no bank currently captures):
- Revenue milestone: Bank has data, sees threshold crossed. No one celebrates it.
- Business anniversary: Nobody marks it. 15 years, 22 staff, bank never acknowledged.
- Employee milestone: Payroll grew from 3 to 18. Bank sees the data, never uses it.
- Peer connection: Most enriching relationships are with peers, not advisors. Bank as connector.
- Personal life transition: Separation, illness. Bank trained to separate personal/business but for owners there IS no separation.

--- CLIENT LIFECYCLE SEGMENTATION (Scotiabank's existing framework) ---

STARTER: Micro businesses, first 3 years, revenue under $500K. Pre-Core, trying to break through.
GROWTH: Ambitious builders/architects actively scaling. Revenue $500K-$5M. Core segment.
STEADY: Strategic optimizers nurturing quality over expansion. Revenue $500K-$5M. Core segment.
SUCCESSION: Mature businesses considering transition, sale, or next generation. Revenue varies.

--- RICHNESS DEFINITIONS (how "rich" is experienced at each stage) ---

POTENTIAL: Richness is survival and validation — proof the idea works. (Dreamer)
IMPACT: Richness is people, relationships, community, seeing your team grow. (Builder)
LIFE WELL-DESIGNED: Richness is peace of mind, absence of threat, rarely worrying. (Sovereign)
STRATEGIC CAPABILITY: Richness is optionality — deals on table, capital to act. (Architect)
FINANCIAL (DEFAULT): Traditional financial metrics — revenue, profit, assets. (Generic/unspecified)

--- CLASSIFICATION RULES ---

1. Portrait assignment should be based on the IMPLIED audience, not the actual product. A piece showing a solo founder overwhelmed = Dreamer, even if the brand is a big bank.
2. Entry door should be based on the MOTIVATION shown or implied in the piece.
3. Journey phase should be based on the BUSINESS STAGE depicted, not the brand's target market.
4. Moments should only be assigned if the piece specifically addresses that moment. Most pieces will be "None."
5. If a piece is purely product-focused with no owner narrative, portrait and entry door should be "None identifiable."
6. Richness definition should match the portrait assignment: Dreamer=Potential, Builder=Impact, Sovereign=Life well-designed, Architect=Strategic capability.
`;
