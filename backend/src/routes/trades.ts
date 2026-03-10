import HyperExpress from 'hyper-express';
import { databaseService } from '../services/DatabaseService.js';

export function tradeRoutes(app: HyperExpress.Server): void {
    // Get trades for a market
    app.get('/api/markets/:id/trades', async (req, res) => {
        try {
            const marketId = parseInt(req.path_parameters.id);
            const limit = parseInt(req.query_parameters.limit || '50');
            const trades = databaseService.getTradesByMarket(marketId, limit);
            res.json({ trades });
        } catch (err) {
            console.error('[trades] GET error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Record a trade (called by frontend after on-chain TX)
    app.post('/api/trades', async (req, res) => {
        try {
            const body = await req.json();
            const { marketId, trader, side, action, collateralAmount, tokenAmount, price, txHash, blockNumber } = body;

            if (!marketId || !trader || !side || !collateralAmount || !txHash) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const tradeId = databaseService.recordTrade({
                market_id: marketId,
                trader,
                side,
                action: action || 'buy',
                collateral_amount: collateralAmount,
                token_amount: tokenAmount || '0',
                price: price || '0',
                tx_hash: txHash,
                block_number: blockNumber || 0,
            });

            // Update user prediction count
            const user = databaseService.getOrCreateUser(trader);
            databaseService.updateUserStats(trader, {
                total_predictions: user.total_predictions + 1,
            });

            res.json({ tradeId });
        } catch (err) {
            console.error('[trades] POST error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });
}
