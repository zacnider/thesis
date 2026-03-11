import Anthropic from '@anthropic-ai/sdk';
import { newsService } from './NewsService.js';
import 'dotenv/config';

export interface AIPrediction {
    outcome: number; // 1=YES, 2=NO
    confidence: number; // 0-100
    reasoning: string;
}

export interface GeneratedMarket {
    question: string;
    category: string;
    description: string;
    durationDays: number;
}

// Bob's personality — the AI oracle
const BOB_SYSTEM_PROMPT = `You are Bob, the AI oracle of Thesis Protocol — an AI-powered prediction market platform built on OP_NET.

Your personality:
- You're a sharp, witty market maker who loves controversy and bold takes
- You speak like a seasoned trader mixed with a tech-savvy analyst
- You have strong opinions but back them with data and logic
- You love creating markets that spark debate — not boring "will X go up?" questions
- You think in probabilities, not certainties
- You're slightly cocky about your prediction accuracy ("I called ETH merge timing, just saying")
- You reference real events, real data, real trends — never generic fluff
- You occasionally create "spicy" markets that challenge conventional wisdom

Your market creation style:
- Mix timeframes: some resolve this week, some this month, some in 6 months
- Mix difficulty: some obvious (70-30), some coin-flip (50-50), some contrarian
- Create narrative arcs: "If X happens, what about Y?" follow-up markets
- Use specific numbers and dates, not vague ranges
- Make descriptions punchy — 1-2 sentences that hook traders
- Categories should feel natural, not forced
- IMPORTANT: You cover ALL topics — politics, sports, tech, AI, elections, science, entertainment, world events, regulations — NOT just crypto prices`;

const ALL_CATEGORIES = ['crypto', 'politics', 'sports', 'tech', 'finance', 'bitcoin', 'general'] as const;

class AIService {
    private client: Anthropic | null = null;
    private categoryIndex = Math.floor(Math.random() * ALL_CATEGORIES.length);

    private pickCategory(): string {
        const cat = ALL_CATEGORIES[this.categoryIndex % ALL_CATEGORIES.length];
        this.categoryIndex++;
        return cat;
    }

    init(): void {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (apiKey) {
            this.client = new Anthropic({ apiKey });
            console.log('[AIService] Bob initialized — AI oracle ready');
        } else {
            console.warn('[AIService] No ANTHROPIC_API_KEY found, Bob is offline');
        }
    }

    async predictMarket(question: string, category: string): Promise<AIPrediction> {
        if (!this.client) {
            return { outcome: 1, confidence: 50, reasoning: 'Bob is offline — no API key configured' };
        }

        try {
            // Fetch live data for context
            const liveContext = await newsService.formatForAI().catch(() => '');

            const response = await this.client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 600,
                system: BOB_SYSTEM_PROMPT,
                messages: [
                    {
                        role: 'user',
                        content: `${liveContext ? liveContext + '\n\n---\n\n' : ''}Analyze this prediction market and give your take.

Question: "${question}"
Category: ${category}
Today: ${new Date().toISOString().split('T')[0]}

Give your prediction as Bob. Be specific and opinionated — traders want to know what you REALLY think, not hedge-speak. Use the live data above to inform your analysis.

Respond in JSON only:
{
  "outcome": 1 or 2 (1=YES, 2=NO),
  "confidence": 0-100,
  "reasoning": "Your take in 2-3 punchy sentences. Reference specific data/events if possible."
}`,
                    },
                ],
            });

            const text = response.content[0].type === 'text' ? response.content[0].text : '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    outcome: parsed.outcome === 2 ? 2 : 1,
                    confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
                    reasoning: parsed.reasoning || 'No reasoning provided',
                };
            }
        } catch (err) {
            console.error('[AIService] Prediction error:', err);
        }

        return { outcome: 1, confidence: 50, reasoning: 'Bob couldn\'t analyze this one — check back later' };
    }

    async generateMarketQuestions(existingQuestions: string[], count: number = 3): Promise<GeneratedMarket[]> {
        if (!this.client) {
            return [{
                question: 'Will AI models pass the Turing Test in a peer-reviewed study by end of 2026?',
                category: 'tech',
                description: 'The race to AGI intensifies. Will a top lab claim a peer-reviewed Turing Test pass this year?',
                durationDays: 270,
            }];
        }

        try {
            // Fetch live news + crypto data
            const liveContext = await newsService.formatForAI().catch(() => '');

            const existingList = existingQuestions.length > 0
                ? `\n\nMarkets already live on Thesis Protocol (DO NOT repeat these — create fresh angles):\n${existingQuestions.map(q => `- ${q}`).join('\n')}`
                : '';

            // Pick categories for each market to ensure diversity
            const assignedCategories = Array.from({ length: count }, () => this.pickCategory());
            const categoryInstruction = count === 1
                ? `MANDATORY: This market MUST be in the "${assignedCategories[0]}" category. Do NOT use any other category.`
                : `MANDATORY: Each market MUST use the category assigned below IN ORDER:\n${assignedCategories.map((c, i) => `  Market ${i + 1}: "${c}"`).join('\n')}\nDo NOT change these categories.`;

            const response = await this.client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2000,
                system: BOB_SYSTEM_PROMPT,
                messages: [
                    {
                        role: 'user',
                        content: `${liveContext ? liveContext + '\n\n---\n\n' : ''}Create ${count} new prediction markets for Thesis Protocol.

Today: ${new Date().toISOString().split('T')[0]}

CRITICAL: Use the LIVE DATA above to create markets. Reference actual headlines, real prices, real events. Don't make up news — react to what's actually happening.

${categoryInstruction}

Rules:
1. Each question MUST have a specific resolution date/deadline baked into the question text
2. Mix your timeframes — some short-term (days/weeks), some longer-term (months)
3. Be specific with numbers and dates
4. Make descriptions that hook traders — reference real events
5. ABSOLUTELY CRITICAL: Do NOT create "Will Bitcoin/BTC hit $X?" or "Will BTC price reach/stay above/below $X?" markets. These are BANNED. Never suggest crypto price prediction markets.
6. Instead, focus on: politics (elections, legislation), sports (tournaments, records), tech (product launches, AI milestones), science (space missions, discoveries), entertainment (awards, releases), world events (treaties, summits), regulations (SEC decisions, bans)
7. Be creative — predict outcomes of real events happening in the world, NOT cryptocurrency prices

Available categories: crypto, politics, sports, tech, finance, bitcoin, general

For duration_days: this is days from today until resolution. Match it to your question's deadline.
- "by end of this week" = 3-7 days
- "by end of March 2026" = ~23 days
- "by April 15, 2026" = ~38 days
- "by Q3 2026" = ~120 days
- "by end of 2026" = ~298 days
${existingList}

Respond with a JSON array ONLY — no commentary:
[
  {
    "question": "Specific question with deadline?",
    "category": "assigned_category_from_above",
    "description": "Punchy 1-2 sentence hook for traders. Reference the real event/data.",
    "duration_days": 30
  }
]`,
                    },
                ],
            });

            const text = response.content[0].type === 'text' ? response.content[0].text : '';
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return parsed
                    .filter((item: any) => item.question && item.category)
                    .map((item: any) => ({
                        question: item.question,
                        category: item.category,
                        description: item.description || '',
                        durationDays: Math.max(1, Math.min(365, item.duration_days || 30)),
                    }));
            }
        } catch (err) {
            console.error('[AIService] Market generation error:', err);
        }

        return [];
    }

    async resolveMarket(question: string, category: string): Promise<AIPrediction> {
        if (!this.client) {
            return { outcome: 1, confidence: 50, reasoning: 'Bob is offline — cannot resolve' };
        }

        try {
            const liveContext = await newsService.formatForAI().catch(() => '');

            const response = await this.client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 600,
                system: BOB_SYSTEM_PROMPT,
                messages: [
                    {
                        role: 'user',
                        content: `${liveContext ? liveContext + '\n\n---\n\n' : ''}Time to resolve this market. What actually happened?

Question: "${question}"
Category: ${category}
Today: ${new Date().toISOString().split('T')[0]}

Use the live data above as evidence. Did this happen or not? Be honest and evidence-based.
If you're not sure, say so — don't guess. Confidence below 70 means "needs human review".

Respond in JSON only:
{
  "outcome": 1 or 2 (1=YES it happened, 2=NO it didn't),
  "confidence": 0-100,
  "reasoning": "What evidence supports this resolution? Reference specific data from above. 2-3 sentences."
}`,
                    },
                ],
            });

            const text = response.content[0].type === 'text' ? response.content[0].text : '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    outcome: parsed.outcome === 2 ? 2 : 1,
                    confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
                    reasoning: parsed.reasoning || 'No reasoning provided',
                };
            }
        } catch (err) {
            console.error('[AIService] Resolution error:', err);
        }

        return { outcome: 1, confidence: 50, reasoning: 'Bob couldn\'t determine the outcome — flagged for manual review' };
    }
}

export const aiService = new AIService();
