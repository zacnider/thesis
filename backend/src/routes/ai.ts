import HyperExpress from 'hyper-express';
import { aiService } from '../services/AIService.js';
import { databaseService } from '../services/DatabaseService.js';

export function aiRoutes(app: HyperExpress.Server): void {
    // Get AI prediction for a question
    app.post('/api/ai/predict', async (req, res) => {
        try {
            const body = await req.json();
            const { question, category } = body;

            if (!question) {
                return res.status(400).json({ error: 'Question required' });
            }

            const prediction = await aiService.predictMarket(question, category || 'general');
            res.json({ prediction });
        } catch (err) {
            console.error('[ai] POST /api/ai/predict error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Get AI prediction for existing market
    app.get('/api/markets/:id/ai-prediction', async (req, res) => {
        try {
            const id = parseInt(req.path_parameters.id);
            const market = databaseService.getMarket(id);

            if (!market) {
                return res.status(404).json({ error: 'Market not found' });
            }

            if (market.ai_prediction !== null) {
                return res.json({
                    prediction: {
                        outcome: market.ai_prediction,
                        confidence: market.ai_confidence,
                        reasoning: market.ai_reasoning,
                    },
                });
            }

            // Generate new prediction
            const prediction = await aiService.predictMarket(market.question, market.category);
            databaseService.updateAIPrediction(id, prediction.outcome, prediction.confidence, prediction.reasoning);
            res.json({ prediction });
        } catch (err) {
            console.error('[ai] GET ai-prediction error:', err);
            res.status(500).json({ error: 'Internal error' });
        }
    });
}
