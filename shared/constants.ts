// Shared constants between backend and frontend

export const CATEGORIES = [
    'crypto',
    'politics',
    'sports',
    'tech',
    'finance',
    'bitcoin',
    'general',
] as const;

export type Category = (typeof CATEGORIES)[number];

// Contract selectors (from ABI)
export const SELECTORS = {
    // PredictionMarket
    BUY_OUTCOME: 0x12345678, // TODO: update from generated ABI
    SELL_OUTCOME: 0x12345679,
    RESOLVE: 0x1234567a,
    REDEEM: 0x1234567b,
    GET_PRICE: 0x1234567c,
    GET_MARKET_INFO: 0x1234567d,
    GET_QUOTE: 0x1234567e,

    // MarketFactory
    REGISTER_MARKET: 0x1234567f,
    GET_MARKET: 0x12345680,
    GET_MARKET_COUNT: 0x12345681,

    // OracleResolver
    PROPOSE_RESOLUTION: 0x12345682,
    DISPUTE_RESOLUTION: 0x12345683,
    FINALIZE_RESOLUTION: 0x12345684,
} as const;

// Outcomes
export const OUTCOME_YES = 1;
export const OUTCOME_NO = 2;

// Fee
export const MAX_FEE_BPS = 500; // 5%
export const DEFAULT_FEE_BPS = 100; // 1%

// Challenge period (blocks)
export const CHALLENGE_PERIOD_BLOCKS = 100;

// AI confidence threshold for auto-resolve
export const AI_AUTO_RESOLVE_THRESHOLD = 80;
