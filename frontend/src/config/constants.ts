export const API_BASE = import.meta.env.VITE_API_URL || '/api';
export const TESTNET_RPC = 'https://testnet.opnet.org';

export const CONTRACTS = {
    FACTORY: 'opt1sqrta4vn7kv30u4zfm3avqy66qfjnzlr36glk9n3y',
    FACTORY_PUBKEY: '0xd51f6848584d7cab1c89bb3e8a9bba619a365e2a25e96f8530b3285ce1475b8e',
    ORACLE: 'opt1sqr93erwvhgdk9rpl7y3pncq6c9n85she3g78xfhj',
    ORACLE_PUBKEY: '0x4d7471d00e22bdf5ebdd6cc42353bb64c33f2b35b9bd45700762fa8b4b99e1b9',
    REPUTATION: 'opt1sqzr36zm92pfcwx2aytxcywyrj6yg7k8cdqadxmcj',
    REPUTATION_PUBKEY: '0x0a63528d48a1ea6315427121aacd6aa7f1b5507b90675c82a90ef2de07dabb2c',
    COLLATERAL_TOKEN: 'opt1sqpwe557whharqy2447m7t8y50u0cspahksfn7kgl',
};

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
