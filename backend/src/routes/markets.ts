import HyperExpress from 'hyper-express';
import { databaseService } from '../services/DatabaseService.js';
import { deployService } from '../services/DeployService.js';
import { aiService } from '../services/AIService.js';

export function marketRoutes(app: HyperExpress.Server): void {
    // List markets
    app.get('/api/markets', async (req, res) => {
        try {
            const status = req.query_parameters.status || undefined;
            const category = req.query_parameters.category || undefined;
            const limit = parseInt(req.query_parameters.limit || '20');
            const offset = parseInt(req.query_parameters.offset || '0');

            const markets = databaseService.getMarkets({ status, category, limit, offset });
            res.json({ markets });
        } catch (err) {
            console.error('[markets] GET /api/markets error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Get single market
    app.get('/api/markets/:id', async (req, res) => {
        try {
            const id = parseInt(req.path_parameters.id);
            const market = databaseService.getMarket(id);
            if (!market) {
                return res.status(404).json({ error: 'Market not found' });
            }
            res.json({ market });
        } catch (err) {
            console.error('[markets] GET /api/markets/:id error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Create market
    app.post('/api/markets', async (req, res) => {
        try {
            const body = await req.json();
            const { question, description, category, endBlock, collateralToken, creator, initialLiquidity, feeRate, imageUrl } = body;

            if (!question || !endBlock || !collateralToken || !creator) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Create DB record
            const marketId = databaseService.createMarket({
                question,
                description: description || '',
                category: category || 'general',
                end_block: endBlock,
                collateral_token: collateralToken,
                creator,
                image_url: imageUrl || null,
            });

            // Get AI prediction for new market
            const prediction = await aiService.predictMarket(question, category || 'general');
            databaseService.updateAIPrediction(marketId, prediction.outcome, prediction.confidence, prediction.reasoning);

            // Start deploy if liquidity provided
            if (initialLiquidity) {
                const result = deployService.startDeploy({
                    marketId,
                    question,
                    endBlock,
                    collateralToken,
                    initialLiquidity,
                    feeRate: feeRate || 100,
                });

                if (!result.started) {
                    return res.json({ marketId, deployed: false, error: result.error, prediction });
                }
            }

            res.json({ marketId, deployed: !!initialLiquidity, prediction });
        } catch (err) {
            console.error('[markets] POST /api/markets error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Resolve market
    app.post('/api/markets/:id/resolve', async (req, res) => {
        try {
            const id = parseInt(req.path_parameters.id);
            const market = databaseService.getMarket(id);
            if (!market) {
                return res.status(404).json({ error: 'Market not found' });
            }
            if (market.status === 'resolved') {
                return res.status(400).json({ error: 'Already resolved' });
            }

            // Get AI resolution
            const resolution = await aiService.resolveMarket(market.question, market.category);

            if (resolution.confidence >= 80) {
                // Auto-resolve
                databaseService.resolveMarket(id, resolution.outcome);
                res.json({ resolved: true, outcome: resolution.outcome, confidence: resolution.confidence, reasoning: resolution.reasoning });
            } else {
                // Flag for manual review
                res.json({ resolved: false, suggestedOutcome: resolution.outcome, confidence: resolution.confidence, reasoning: resolution.reasoning, message: 'Confidence too low for auto-resolve' });
            }
        } catch (err) {
            console.error('[markets] POST /api/markets/:id/resolve error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Force resolve (admin)
    app.post('/api/markets/:id/force-resolve', async (req, res) => {
        try {
            const id = parseInt(req.path_parameters.id);
            const body = await req.json();
            const { outcome } = body;

            if (outcome !== 1 && outcome !== 2) {
                return res.status(400).json({ error: 'Outcome must be 1 (YES) or 2 (NO)' });
            }

            const market = databaseService.getMarket(id);
            if (!market) {
                return res.status(404).json({ error: 'Market not found' });
            }

            databaseService.resolveMarket(id, outcome);
            res.json({ resolved: true, outcome });
        } catch (err) {
            console.error('[markets] POST /api/markets/:id/force-resolve error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Admin: Clear all markets
    app.post('/api/admin/clear-markets', async (req, res) => {
        try {
            databaseService.clearAllMarkets();
            res.json({ success: true, message: 'All markets cleared' });
        } catch (err) {
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Admin: Trigger AI market generation + auto-deploy
    app.post('/api/admin/generate-markets', async (req, res) => {
        try {
            const body = await req.json().catch(() => ({}));
            const count = Math.min(body.count || 1, 5);

            const existingQuestions = databaseService.getRecentMarketQuestions(30);
            const newMarkets = await aiService.generateMarketQuestions(existingQuestions, count);

            const currentBlock = await (await import('../services/ChainService.js')).chainService.getBlockNumber();
            const created: number[] = [];

            const BLOCKS_PER_DAY = 144;
            const DEFAULT_LIQUIDITY = '1000000000000000000000';
            const DEFAULT_FEE_RATE = 100;

            const collateral = deployService.getCollateralInfo();

            for (const market of newMarkets) {
                const durationBlocks = market.durationDays * BLOCKS_PER_DAY;
                const endBlock = currentBlock > 0 ? currentBlock + durationBlocks : 999999;
                const marketId = databaseService.createMarket({
                    question: market.question,
                    description: market.description,
                    category: market.category,
                    end_block: endBlock,
                    collateral_token: collateral.address || '',
                    creator: 'bob-ai',
                });

                const prediction = await aiService.predictMarket(market.question, market.category);
                databaseService.updateAIPrediction(marketId, prediction.outcome, prediction.confidence, prediction.reasoning);
                created.push(marketId);

                // Auto-deploy if not already deploying
                if (!deployService.isDeploying()) {
                    deployService.startDeploy({
                        marketId,
                        question: market.question,
                        endBlock,
                        collateralToken: collateral.address || '',
                        initialLiquidity: DEFAULT_LIQUIDITY,
                        feeRate: DEFAULT_FEE_RATE,
                    });
                }
            }

            res.json({ success: true, created, count: created.length });
        } catch (err) {
            console.error('[markets] POST /api/admin/generate-markets error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Deploy status — also updates DB when deploy completes
    app.get('/api/deploy-status', async (req, res) => {
        try {
            const status = deployService.getStatus();

            // When deploy completes, save addresses to DB
            if (status.status === 'complete' && status.marketId && status.marketAddress) {
                try {
                    databaseService.updateMarketAddresses(status.marketId, {
                        market_address: status.marketAddress,
                        market_pub_key: status.marketPubKey || '',
                        yes_token: status.yesTokenAddress || '',
                        yes_token_pub_key: status.yesTokenPubKey || '',
                        no_token: status.noTokenAddress || '',
                        no_token_pub_key: status.noTokenPubKey || '',
                        lending_pool_address: status.lendingPoolAddress || '',
                        lending_pool_pub_key: status.lendingPoolPubKey || '',
                    });
                } catch {}
            }

            res.json(status);
        } catch (err) {
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Start deploy for existing market
    app.post('/api/markets/:id/deploy', async (req, res) => {
        try {
            const id = parseInt(req.path_parameters.id);
            const market = databaseService.getMarket(id);
            if (!market) {
                return res.status(404).json({ error: 'Market not found' });
            }

            const body = await req.json();
            const result = deployService.startDeploy({
                marketId: id,
                question: market.question,
                endBlock: market.end_block,
                collateralToken: market.collateral_token || 'native',
                initialLiquidity: body.initialLiquidity || '1000000000000000000000',
                feeRate: body.feeRate || 100,
            });

            res.json(result);
        } catch (err) {
            console.error('[markets] POST /api/markets/:id/deploy error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });
}
