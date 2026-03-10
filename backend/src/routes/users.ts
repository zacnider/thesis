import HyperExpress from 'hyper-express';
import { databaseService } from '../services/DatabaseService.js';

export function userRoutes(app: HyperExpress.Server): void {
    // Leaderboard
    app.get('/api/leaderboard', async (req, res) => {
        try {
            const limit = parseInt(req.query_parameters.limit || '50');
            const users = databaseService.getLeaderboard(limit);

            const leaderboard = users.map((u, i) => ({
                rank: i + 1,
                address: u.address,
                totalPredictions: u.total_predictions,
                correctPredictions: u.correct_predictions,
                accuracy: u.total_predictions > 0
                    ? Math.round((u.correct_predictions / u.total_predictions) * 100)
                    : 0,
                winStreak: u.win_streak,
                bestStreak: u.best_streak,
                totalProfit: u.total_profit,
            }));

            res.json({ leaderboard });
        } catch (err) {
            console.error('[users] GET /api/leaderboard error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // User portfolio
    app.get('/api/users/:address/portfolio', async (req, res) => {
        try {
            const address = req.path_parameters.address;
            const user = databaseService.getOrCreateUser(address);
            const trades = databaseService.getTradesByUser(address, 100);

            // Group trades by market
            const positionsByMarket: Record<number, any> = {};
            for (const trade of trades) {
                if (!positionsByMarket[trade.market_id]) {
                    const market = databaseService.getMarket(trade.market_id);
                    positionsByMarket[trade.market_id] = {
                        market,
                        trades: [],
                    };
                }
                positionsByMarket[trade.market_id].trades.push(trade);
            }

            res.json({
                user: {
                    address: user.address,
                    totalPredictions: user.total_predictions,
                    correctPredictions: user.correct_predictions,
                    accuracy: user.total_predictions > 0
                        ? Math.round((user.correct_predictions / user.total_predictions) * 100)
                        : 0,
                    winStreak: user.win_streak,
                    bestStreak: user.best_streak,
                    totalProfit: user.total_profit,
                },
                positions: Object.values(positionsByMarket),
            });
        } catch (err) {
            console.error('[users] GET portfolio error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Platform stats
    app.get('/api/stats', async (req, res) => {
        try {
            const stats = databaseService.getStats();
            res.json({ stats });
        } catch (err) {
            console.error('[users] GET /api/stats error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });
}
