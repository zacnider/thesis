# THESIS PROTOCOL — AI-Powered Prediction Markets on Bitcoin L1

> The first prediction market with AI oracle resolution and collateralized outcome-token lending, built on Bitcoin L1 via OP_NET.

![Bitcoin](https://img.shields.io/badge/Bitcoin-L1-orange) ![OP_NET](https://img.shields.io/badge/OP__NET-Testnet-purple) ![AI](https://img.shields.io/badge/AI-Oracle-gold)

## What Makes Thesis Protocol Different

**1. AI Oracle Resolution** — Our AI oracle analyzes real-world data to automatically resolve markets when confidence exceeds 80%. Below that threshold, markets enter a bond-based dispute mechanism.

**2. Beat the Bot** — AI predicts every market. Users compete against AI, building reputation scores and climbing the leaderboard. Can you outpredict artificial intelligence?

**3. CPMM AMM on Bitcoin** — Constant Product Market Maker (x*y=k) for binary outcomes, enabling continuous price discovery. Buy/sell YES and NO tokens with instant liquidity.

**4. Bond-Based Dispute Resolution** — Proposer stakes a bond on the outcome. Anyone can dispute with 2x bond within 100 blocks. Economic security without centralized trust.

**5. Collateralized Lending** — Deposit YES/NO outcome tokens as collateral to borrow tUSDT. On-chain LTV enforcement and interest accrual.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│   React + Vite + TypeScript                                 │
│   Brutalist UI — Syne + DM Mono                             │
│   Pages: Home, Explore, Market Detail, Create,              │
│          Portfolio, Lending, Leaderboard                    │
├─────────────────────────────────────────────────────────────┤
│                        BACKEND                              │
│   hyper-express API + SQLite + Anthropic AI                 │
│   /api/markets, /api/trades, /api/ai, /api/leaderboard      │
├─────────────────────────────────────────────────────────────┤
│                     SMART CONTRACTS                         │
│   ┌───────────────┐  ┌──────────────┐  ┌────────────────┐   │
│   │ PredictionMkt │  │ OutcomeToken │  │ MarketFactory  │   │
│   │ CPMM AMM      │  │ OP20 YES/NO  │  │ Registry       │   │
│   └───────────────┘  └──────────────┘  └────────────────┘   │
│   ┌───────────────┐  ┌──────────────┐  ┌────────────────┐   │
│   │ OracleResolver│  │ Reputation   │  │ LendingPool    │   │
│   │ Bond disputes │  │ Stats/Streak │  │ Collat. Loans  │   │
│   └───────────────┘  └──────────────┘  └────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                   BITCOIN L1 (OP_NET)                       │
└─────────────────────────────────────────────────────────────┘
```

## Smart Contracts

| Contract | Description | WASM Size |
|----------|-------------|-----------|
| **PredictionMarket** | CPMM AMM — buy/sell outcomes, resolve, redeem | 26 KB |
| **OutcomeToken** | OP20 token for YES/NO outcomes | 35 KB |
| **MarketFactory** | Market registry with active/resolved tracking | 20 KB |
| **OracleResolver** | Bond-based dispute resolution (100-block challenge) | 26 KB |
| **ReputationTracker** | User prediction stats, streaks, accuracy | 23 KB |
| **LendingPool** | Collateralized lending with YES/NO tokens | 24 KB |

## CPMM Pricing

```
YES_reserve × NO_reserve = k (constant)

Buy YES:  newNoRes = noRes + amount; newYesRes = k / newNoRes; tokensOut = yesRes - newYesRes
Buy NO:   newYesRes = yesRes + amount; newNoRes = k / newYesRes; tokensOut = noRes - newNoRes

Price:    yesPrice = noReserve / (yesReserve + noReserve)
          noPrice  = yesReserve / (yesReserve + noReserve)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/markets` | List markets (filter: status, category) |
| GET | `/api/markets/:id` | Single market details |
| POST | `/api/markets` | Create market + get AI prediction |
| POST | `/api/markets/:id/resolve` | AI-powered resolution |
| GET | `/api/markets/:id/trades` | Trade history |
| POST | `/api/trades` | Record a trade |
| POST | `/api/ai/predict` | Get AI prediction |
| GET | `/api/leaderboard` | Top predictors |
| GET | `/api/users/:addr/portfolio` | User positions |
| GET | `/api/users/:addr/lending` | User lending positions |
| GET | `/api/stats` | Platform statistics |
| GET | `/api/collateral-token` | Collateral token info |

## Quick Start

### Prerequisites
- Node.js 22+
- Testnet BTC (get from OP_NET faucet)

### 1. Smart Contracts
```bash
cd contracts
npm install
npm run build          # Builds all 6 WASM contracts
npx tsx deploy.ts      # Deploy singletons to testnet
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env   # Set MNEMONIC and ANTHROPIC_API_KEY
npm run dev            # Starts on :3002
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev            # Starts on :5173
```

## Project Structure

```
thesis-protocol/
├── contracts/
│   ├── src/
│   │   ├── market/PredictionMarket.ts      # CPMM AMM core
│   │   ├── outcome-token/OutcomeToken.ts   # OP20 YES/NO tokens
│   │   ├── factory/MarketFactory.ts        # Market registry
│   │   ├── oracle/OracleResolver.ts        # Bond-based disputes
│   │   ├── reputation/ReputationTracker.ts # User stats
│   │   └── lending/LendingPool.ts          # Collateralized lending
│   ├── build/                              # Compiled WASM
│   ├── abis/                               # Generated ABIs
│   └── deploy.ts                           # Deployment script
├── backend/
│   ├── src/
│   │   ├── index.ts                        # hyper-express server
│   │   ├── routes/                         # API routes
│   │   └── services/                       # Business logic + AI
│   └── data/                               # SQLite database
├── frontend/
│   ├── src/
│   │   ├── pages/                          # React pages
│   │   ├── components/                     # UI components
│   │   ├── hooks/                          # Custom hooks
│   │   ├── context/                        # Provider context
│   │   └── config/                         # ABIs + constants
│   └── dist/                               # Built frontend
├── shared/
│   ├── types.ts                            # Shared TypeScript types
│   └── constants.ts                        # Shared constants
├── AUDIT.md                                # Security audit report
└── README.md                               # This file
```

## Security

See [AUDIT.md](./AUDIT.md) for the full security audit report.

Key security properties:
- **SafeMath** on all u256 arithmetic
- **CEI pattern** (Checks-Effects-Interactions)
- **Owner-only** access control on admin functions
- **No unbounded loops** or floating-point math
- **Fee cap** at 500 basis points (5%)
- **Bond-based disputes** for oracle resolution trust
- **On-chain LTV enforcement** for lending positions

## Tech Stack

- **Contracts**: AssemblyScript → WASM (OP_NET btc-runtime)
- **Backend**: hyper-express + SQLite + Anthropic Claude API
- **Frontend**: React + Vite + TypeScript
- **Blockchain**: Bitcoin L1 via OP_NET metaprotocol

## Links

- **Website**: [thesisprotocol.org](https://thesisprotocol.org)
- **Twitter**: [@prematrkurtcuk](https://x.com/prematrkurtcuk)
- **GitHub**: [zacnider](https://github.com/zacnider)

## License

MIT

---

Built on Bitcoin L1 — Everything that ran on ETH and SOL, now on Bitcoin.
