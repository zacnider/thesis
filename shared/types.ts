// Shared types between backend and frontend

export interface Market {
    id: number;
    question: string;
    description: string;
    category: string;
    status: 'active' | 'resolved' | 'disputed';
    endBlock: number;
    collateralToken: string;
    marketAddress: string;
    yesToken: string;
    noToken: string;
    creator: string;
    createdAt: string;
    resolvedAt: string | null;
    winningOutcome: number | null;
    aiPrediction: number | null;
    aiConfidence: number | null;
    aiReasoning: string | null;
}

export interface Trade {
    id: number;
    marketId: number;
    trader: string;
    side: 'YES' | 'NO';
    action: 'buy' | 'sell';
    collateralAmount: string;
    tokenAmount: string;
    price: string;
    txHash: string;
    blockNumber: number;
    createdAt: string;
}

export interface UserStats {
    address: string;
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
    winStreak: number;
    bestStreak: number;
    totalProfit: string;
}

export interface AIPrediction {
    outcome: number; // 1=YES, 2=NO
    confidence: number; // 0-100
    reasoning: string;
}

export interface PlatformStats {
    totalMarkets: number;
    activeMarkets: number;
    resolvedMarkets: number;
    totalTrades: number;
    totalUsers: number;
}
