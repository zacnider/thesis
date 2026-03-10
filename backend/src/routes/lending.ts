import HyperExpress from 'hyper-express';
import { databaseService } from '../services/DatabaseService.js';

export function lendingRoutes(app: HyperExpress.Server): void {
    // Get lending pool info for a market
    app.get('/api/markets/:id/lending', async (req, res) => {
        try {
            const id = parseInt(req.path_parameters.id);
            const market = databaseService.getMarket(id);
            if (!market) {
                return res.status(404).json({ error: 'Market not found' });
            }

            const positions = databaseService.getLendingPositionsByMarket(id);

            res.json({
                marketId: id,
                lendingPoolAddress: market.lending_pool_address || '',
                lendingPoolPubKey: market.lending_pool_pub_key || '',
                hasLendingPool: !!(market.lending_pool_address),
                positions,
                totalPositions: positions.length,
                activePositions: positions.filter(p => p.status === 'active').length,
            });
        } catch (err) {
            console.error('[lending] GET /api/markets/:id/lending error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Get user's lending positions across all markets
    app.get('/api/users/:address/lending', async (req, res) => {
        try {
            const address = req.path_parameters.address;
            const positions = databaseService.getLendingPositionsByUser(address);
            res.json({ positions });
        } catch (err) {
            console.error('[lending] GET /api/users/:address/lending error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Record a lending action (deposit/borrow/repay/withdraw)
    app.post('/api/lending', async (req, res) => {
        try {
            const body = await req.json();
            const { marketId, borrower, action, yesCollateral, noCollateral, borrowed, interestOwed, txHash } = body;

            if (!marketId || !borrower || !action) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            if (action === 'deposit' || action === 'borrow') {
                const positionId = databaseService.recordLendingPosition({
                    market_id: marketId,
                    borrower,
                    yes_collateral: yesCollateral || '0',
                    no_collateral: noCollateral || '0',
                    borrowed: borrowed || '0',
                    interest_owed: interestOwed || '0',
                    tx_hash: txHash || '',
                });
                res.json({ positionId, action });
            } else if (action === 'repay' || action === 'withdraw' || action === 'liquidate') {
                const { positionId } = body;
                if (!positionId) {
                    return res.status(400).json({ error: 'positionId required for update actions' });
                }
                databaseService.updateLendingPosition(positionId, {
                    yes_collateral: yesCollateral,
                    no_collateral: noCollateral,
                    borrowed,
                    interest_owed: interestOwed,
                    status: action === 'liquidate' ? 'liquidated' : (borrowed === '0' ? 'closed' : 'active'),
                    tx_hash: txHash,
                });
                res.json({ positionId, action, updated: true });
            } else {
                res.status(400).json({ error: 'Invalid action. Use: deposit, borrow, repay, withdraw, liquidate' });
            }
        } catch (err) {
            console.error('[lending] POST /api/lending error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Platform lending stats
    app.get('/api/lending/stats', async (req, res) => {
        try {
            const stats = databaseService.getLendingStats();
            res.json(stats);
        } catch (err) {
            res.status(500).json({ error: 'Internal error' });
        }
    });
}
