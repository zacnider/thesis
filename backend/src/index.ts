import HyperExpress from 'hyper-express';
import 'dotenv/config';
import { databaseService } from './services/DatabaseService.js';
import { aiService } from './services/AIService.js';
import { chainService } from './services/ChainService.js';
import { deployService } from './services/DeployService.js';
import { marketRoutes } from './routes/markets.js';
import { tradeRoutes } from './routes/trades.js';
import { aiRoutes } from './routes/ai.js';
import { userRoutes } from './routes/users.js';
import { lendingRoutes } from './routes/lending.js';

const app = new HyperExpress.Server({ max_body_length: 10 * 1024 * 1024 });
const PORT = parseInt(process.env.PORT || '3002');

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Rate limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>();
app.use((req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const entry = rateLimits.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimits.set(ip, { count: 1, resetAt: now + 60000 });
        return next();
    }

    entry.count++;
    if (entry.count > 100) {
        return res.status(429).json({ error: 'Too many requests' });
    }
    next();
});

// Register routes
marketRoutes(app);
tradeRoutes(app);
aiRoutes(app);
userRoutes(app);
lendingRoutes(app);

// Health check
app.get('/api/health', async (req, res) => {
    res.json({ status: 'ok', service: 'thesis-api' });
});

// Collateral token info endpoint
app.get('/api/collateral-token', async (req, res) => {
    const info = deployService.getCollateralInfo();
    res.json({
        address: info.address,
        pubKey: info.pubKey,
        deployed: deployService.hasCollateralToken(),
        deploying: deployService.isDeployingCollateral(),
    });
});

// Admin: Deploy tUSDT collateral token
app.post('/api/admin/deploy-collateral', async (req, res) => {
    try {
        if (deployService.hasCollateralToken()) {
            const info = deployService.getCollateralInfo();
            return res.json({ success: true, message: 'Already deployed', ...info });
        }
        const info = await deployService.deployCollateralToken();
        res.json({ success: true, ...info });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ========================================
// Block Watcher — AI Auto-Market Generation + Deploy Queue
// ========================================
const BLOCKS_PER_GENERATION = 20;
const MAX_ACTIVE_MARKETS = 15;
const POLL_INTERVAL_MS = 30_000; // 30 seconds
const BLOCKS_PER_DAY = 144; // ~10 min per block → 144 blocks/day
const DEPLOY_CHECK_INTERVAL_MS = 15_000; // check deploy queue every 15s
const DEFAULT_LIQUIDITY = '1000000000000000000000'; // 1000 * 10^18
const DEFAULT_FEE_RATE = 100; // 1% in bps

let lastCheckedBlock = 0;
let lastGenerationBlock = 0;
let isGenerating = false;
let isProcessingDeploy = false;

async function autoGenerateMarkets(): Promise<void> {
    if (isGenerating) return;
    isGenerating = true;

    try {
        // Don't generate if tUSDT not ready
        if (!deployService.hasCollateralToken()) {
            isGenerating = false;
            return;
        }

        const currentBlock = await chainService.getBlockNumber();
        if (currentBlock === 0) {
            isGenerating = false;
            return;
        }

        // Initialize on first run
        if (lastCheckedBlock === 0) {
            lastCheckedBlock = currentBlock;
            lastGenerationBlock = currentBlock;
            console.log(`[BlockWatcher] Starting at block ${currentBlock}`);
            isGenerating = false;
            return;
        }

        // Check if enough blocks have passed
        const blocksSinceLastGen = currentBlock - lastGenerationBlock;
        if (blocksSinceLastGen < BLOCKS_PER_GENERATION) {
            lastCheckedBlock = currentBlock;
            isGenerating = false;
            return;
        }

        // CRITICAL: Don't generate if deploy is in progress
        if (deployService.isDeploying() || isProcessingDeploy) {
            console.log(`[BlockWatcher] Deploy in progress, waiting...`);
            lastCheckedBlock = currentBlock;
            isGenerating = false;
            return;
        }

        // CRITICAL: Don't generate if there are undeployed markets in DB
        const undeployed = databaseService.getUndeployedMarkets();
        if (undeployed.length > 0) {
            console.log(`[BlockWatcher] ${undeployed.length} undeployed market(s), waiting for deploy to complete`);
            lastCheckedBlock = currentBlock;
            isGenerating = false;
            return;
        }

        // Check active market count
        const activeCount = databaseService.getActiveMarketCount();
        if (activeCount >= MAX_ACTIVE_MARKETS) {
            console.log(`[BlockWatcher] Already ${activeCount} active markets, skipping generation`);
            lastGenerationBlock = currentBlock;
            lastCheckedBlock = currentBlock;
            isGenerating = false;
            return;
        }

        console.log(`[BlockWatcher] Block ${currentBlock} — all markets deployed, generating new one...`);

        const collateral = deployService.getCollateralInfo();
        const existingQuestions = databaseService.getAllMarketQuestions();
        const newMarkets = await aiService.generateMarketQuestions(existingQuestions, 1);

        for (const market of newMarkets) {
            // Duplicate check: skip if question already exists
            if (databaseService.questionExists(market.question)) {
                console.log(`[BlockWatcher] Duplicate skipped: "${market.question}"`);
                continue;
            }

            const durationBlocks = market.durationDays * BLOCKS_PER_DAY;
            const endBlock = currentBlock + durationBlocks;
            const marketId = databaseService.createMarket({
                question: market.question,
                description: market.description,
                category: market.category,
                end_block: endBlock,
                collateral_token: collateral.address, // tUSDT address
                creator: 'bob-ai',
            });

            const prediction = await aiService.predictMarket(market.question, market.category);
            databaseService.updateAIPrediction(marketId, prediction.outcome, prediction.confidence, prediction.reasoning);

            console.log(`[BlockWatcher] Created market #${marketId}: "${market.question}" — AI: ${prediction.outcome === 1 ? 'YES' : 'NO'} ${prediction.confidence}% — needs deploy`);
        }

        lastGenerationBlock = currentBlock;
        lastCheckedBlock = currentBlock;
    } catch (err) {
        console.error('[BlockWatcher] Error:', err);
    }

    isGenerating = false;
}

// ========================================
// Deploy Processor — picks up undeployed markets from DB
// ========================================
async function processUndeployedMarkets(): Promise<void> {
    if (isProcessingDeploy) return;
    if (deployService.isDeploying()) return;
    if (!deployService.hasCollateralToken()) return; // Wait for tUSDT

    // Check DB for undeployed markets
    const undeployed = databaseService.getUndeployedMarkets();
    if (undeployed.length === 0) return;

    const item = undeployed[0];
    isProcessingDeploy = true;

    console.log(`[Deploy] Starting deploy for market #${item.id}: "${item.question}"`);

    try {
        const collateral = deployService.getCollateralInfo();
        const result = deployService.startDeploy({
            marketId: item.id,
            question: item.question,
            endBlock: item.end_block,
            collateralToken: collateral.address,
            initialLiquidity: DEFAULT_LIQUIDITY,
            feeRate: DEFAULT_FEE_RATE,
        });

        if (!result.started) {
            console.error(`[Deploy] Failed to start: ${result.error}`);
            // If permanent failure, delete the market so it doesn't block the queue
            if (result.error !== 'Another deployment in progress') {
                console.error(`[Deploy] Removing market #${item.id} due to permanent deploy failure`);
                databaseService.resolveMarket(item.id, 0); // mark as failed
            }
            isProcessingDeploy = false;
            return;
        }

        // Poll until deploy completes or fails
        const maxWait = 90 * 60 * 1000; // 90 min — 5 steps x ~10-15min per block
        const start = Date.now();
        while (Date.now() - start < maxWait) {
            await new Promise(r => setTimeout(r, DEPLOY_CHECK_INTERVAL_MS));
            const status = deployService.getStatus();

            if (status.status === 'complete') {
                if (status.marketAddress) {
                    databaseService.updateMarketAddresses(item.id, {
                        market_address: status.marketAddress,
                        market_pub_key: status.marketPubKey || '',
                        yes_token: status.yesTokenAddress || '',
                        yes_token_pub_key: status.yesTokenPubKey || '',
                        no_token: status.noTokenAddress || '',
                        no_token_pub_key: status.noTokenPubKey || '',
                        lending_pool_address: status.lendingPoolAddress || '',
                        lending_pool_pub_key: status.lendingPoolPubKey || '',
                    });
                    // Also update collateral_token in case it was empty
                    databaseService.updateCollateralToken(item.id, collateral.address);
                    console.log(`[Deploy] Market #${item.id} deployed successfully! Market: ${status.marketAddress}, LendingPool: ${status.lendingPoolAddress || 'N/A'}`);
                }
                isProcessingDeploy = false;
                return;
            }

            if (status.status === 'failed') {
                console.error(`[Deploy] Market #${item.id} failed: ${status.error}`);
                isProcessingDeploy = false;
                return;
            }
        }

        console.error(`[Deploy] Market #${item.id} timed out after 90 min`);
    } catch (err) {
        console.error('[Deploy] Error:', err);
    }

    isProcessingDeploy = false;
}

function startBlockWatcher(): void {
    console.log(`[BlockWatcher] Starting — generating markets every ${BLOCKS_PER_GENERATION} blocks`);
    setInterval(autoGenerateMarkets, POLL_INTERVAL_MS);
    autoGenerateMarkets();
}

function startDeployProcessor(): void {
    console.log(`[Deploy] Starting — checking for undeployed markets every ${DEPLOY_CHECK_INTERVAL_MS / 1000}s`);
    setInterval(processUndeployedMarkets, DEPLOY_CHECK_INTERVAL_MS);
}

// Initialize services and start
async function start(): Promise<void> {
    try {
        databaseService.init();
        console.log('[Thesis] Database initialized');

        aiService.init();
        console.log('[Thesis] AI service initialized');

        chainService.init();
        console.log('[Thesis] Chain service initialized');

        await deployService.init();
        console.log('[Thesis] Deploy service initialized');

        // Check tUSDT collateral token
        if (deployService.hasCollateralToken()) {
            const info = deployService.getCollateralInfo();
            console.log(`[Thesis] tUSDT collateral token ready: ${info.address}`);
        } else {
            console.log('[Thesis] tUSDT not deployed — deploying now (will take ~10 min for block confirmation)...');
            // Deploy in background — don't block server startup
            deployService.deployCollateralToken().then((info) => {
                console.log(`[Thesis] tUSDT deployed: ${info.address}`);
            }).catch((err) => {
                console.error('[Thesis] tUSDT deploy failed:', err);
                console.log('[Thesis] Use POST /api/admin/deploy-collateral to retry');
            });
        }

        const undeployed = databaseService.getUndeployedMarkets();
        if (undeployed.length > 0) {
            console.log(`[Thesis] Found ${undeployed.length} undeployed market(s) — deploy processor will handle them`);
        }

        await app.listen(PORT);
        console.log(`[Thesis] API server running on port ${PORT}`);

        // Start block watcher (generates markets only when all previous are deployed)
        startBlockWatcher();

        // Start deploy processor (picks undeployed markets from DB)
        startDeployProcessor();
    } catch (err) {
        console.error('[Thesis] Failed to start:', err);
        process.exit(1);
    }
}

start();
