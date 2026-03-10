/**
 * NewsService — Fetches live news headlines + crypto market data
 * Used by Bob (AIService) to create markets based on real-world events
 *
 * Data sources (all free, no API key required):
 * - CoinGecko: BTC/ETH/SOL prices, market cap, 24h change
 * - RSS/Atom feeds: Top news from major outlets
 */

export interface CryptoPrice {
    symbol: string;
    price: number;
    change24h: number;
    marketCap: number;
}

export interface NewsHeadline {
    title: string;
    source: string;
    category: string;
}

export interface WorldContext {
    crypto: CryptoPrice[];
    news: NewsHeadline[];
    timestamp: string;
}

class NewsService {
    private cache: WorldContext | null = null;
    private cacheExpiry = 0;
    private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 min cache

    async getWorldContext(): Promise<WorldContext> {
        const now = Date.now();
        if (this.cache && now < this.cacheExpiry) {
            return this.cache;
        }

        const [crypto, news] = await Promise.all([
            this.fetchCryptoPrices(),
            this.fetchNewsHeadlines(),
        ]);

        this.cache = {
            crypto,
            news,
            timestamp: new Date().toISOString(),
        };
        this.cacheExpiry = now + this.CACHE_TTL_MS;

        console.log(`[NewsService] Updated context: ${crypto.length} coins, ${news.length} headlines`);
        return this.cache;
    }

    formatForAI(): Promise<string> {
        return this.getWorldContext().then(ctx => {
            let text = `=== LIVE MARKET DATA (${ctx.timestamp}) ===\n\n`;

            // Crypto prices
            if (ctx.crypto.length > 0) {
                text += `CRYPTO PRICES:\n`;
                for (const c of ctx.crypto) {
                    const dir = c.change24h >= 0 ? '▲' : '▼';
                    text += `- ${c.symbol}: $${c.price.toLocaleString()} (${dir} ${Math.abs(c.change24h).toFixed(1)}% 24h) | MCap: $${(c.marketCap / 1e9).toFixed(0)}B\n`;
                }
                text += '\n';
            }

            // News headlines
            if (ctx.news.length > 0) {
                text += `TODAY'S HEADLINES:\n`;
                for (const n of ctx.news) {
                    text += `- [${n.source}] ${n.title}\n`;
                }
                text += '\n';
            }

            text += `Use this REAL data to create markets that traders actually care about right now. Reference specific numbers, events, and trends from above.`;
            return text;
        });
    }

    private async fetchCryptoPrices(): Promise<CryptoPrice[]> {
        try {
            const res = await fetch(
                'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,dogecoin,cardano,polkadot,avalanche-2,chainlink&order=market_cap_desc&sparkline=false',
                { signal: AbortSignal.timeout(10000) },
            );

            if (!res.ok) {
                console.warn(`[NewsService] CoinGecko returned ${res.status}`);
                return this.getFallbackCrypto();
            }

            const data = await res.json() as any[];
            return data.map(coin => ({
                symbol: (coin.symbol as string).toUpperCase(),
                price: coin.current_price || 0,
                change24h: coin.price_change_percentage_24h || 0,
                marketCap: coin.market_cap || 0,
            }));
        } catch (err) {
            console.warn('[NewsService] CoinGecko fetch failed:', (err as Error).message);
            return this.getFallbackCrypto();
        }
    }

    private async fetchNewsHeadlines(): Promise<NewsHeadline[]> {
        const headlines: NewsHeadline[] = [];

        // Fetch from multiple RSS feeds in parallel
        const feeds = [
            { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC', category: 'general' },
            { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'NYT', category: 'general' },
            { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', source: 'BBC Tech', category: 'tech' },
            { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Biz', category: 'finance' },
            { url: 'https://cointelegraph.com/rss', source: 'CoinTelegraph', category: 'crypto' },
            { url: 'https://feeds.bbci.co.uk/sport/rss.xml', source: 'BBC Sport', category: 'sports' },
        ];

        const results = await Promise.allSettled(
            feeds.map(feed => this.fetchRSS(feed.url, feed.source, feed.category)),
        );

        for (const result of results) {
            if (result.status === 'fulfilled') {
                headlines.push(...result.value);
            }
        }

        // Dedupe and limit
        const seen = new Set<string>();
        const unique: NewsHeadline[] = [];
        for (const h of headlines) {
            const key = h.title.toLowerCase().slice(0, 50);
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(h);
            }
        }

        return unique.slice(0, 25); // Max 25 headlines for context
    }

    private async fetchRSS(url: string, source: string, category: string): Promise<NewsHeadline[]> {
        try {
            const res = await fetch(url, {
                signal: AbortSignal.timeout(8000),
                headers: { 'User-Agent': 'ThesisProtocol-Bot/1.0' },
            });

            if (!res.ok) return [];

            const xml = await res.text();

            // Simple XML title extraction (no dependency needed)
            const titles: NewsHeadline[] = [];
            const itemRegex = /<item[\s>][\s\S]*?<\/item>/gi;
            const titleRegex = /<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i;

            let match;
            let count = 0;
            while ((match = itemRegex.exec(xml)) !== null && count < 5) {
                const titleMatch = titleRegex.exec(match[0]);
                if (titleMatch && titleMatch[1]) {
                    const title = titleMatch[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
                    if (title.length > 10) {
                        titles.push({ title, source, category });
                        count++;
                    }
                }
            }

            return titles;
        } catch {
            return [];
        }
    }

    private getFallbackCrypto(): CryptoPrice[] {
        // Fallback if CoinGecko is down — use approximate values
        return [
            { symbol: 'BTC', price: 85000, change24h: 0, marketCap: 1.7e12 },
            { symbol: 'ETH', price: 3500, change24h: 0, marketCap: 420e9 },
            { symbol: 'SOL', price: 150, change24h: 0, marketCap: 70e9 },
        ];
    }
}

export const newsService = new NewsService();
