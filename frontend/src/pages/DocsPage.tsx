import { useState } from 'react';
import type { CSSProperties } from 'react';

type Section = 'overview' | 'architecture' | 'markets' | 'trading' | 'lending' | 'ai' | 'contracts' | 'tokens' | 'faq';

const sections: { id: Section; title: string }[] = [
    { id: 'overview', title: 'Overview' },
    { id: 'architecture', title: 'Architecture' },
    { id: 'markets', title: 'Prediction Markets' },
    { id: 'trading', title: 'Trading' },
    { id: 'lending', title: 'Lending & Borrowing' },
    { id: 'ai', title: 'AI Oracle (Bob)' },
    { id: 'contracts', title: 'Smart Contracts' },
    { id: 'tokens', title: 'Token Standard' },
    { id: 'faq', title: 'FAQ' },
];

export default function DocsPage() {
    const [active, setActive] = useState<Section>('overview');

    return (
        <div className="container" style={s.page}>
            {/* Sidebar */}
            <aside style={s.sidebar}>
                <div style={s.sidebarTitle}>// Documentation</div>
                {sections.map((sec) => (
                    <button
                        key={sec.id}
                        style={{ ...s.sidebarLink, ...(active === sec.id ? s.sidebarActive : {}) }}
                        onClick={() => setActive(sec.id)}
                    >
                        {sec.title}
                    </button>
                ))}
            </aside>

            {/* Content */}
            <main style={s.content}>
                {active === 'overview' && <OverviewSection />}
                {active === 'architecture' && <ArchitectureSection />}
                {active === 'markets' && <MarketsSection />}
                {active === 'trading' && <TradingSection />}
                {active === 'lending' && <LendingSection />}
                {active === 'ai' && <AISection />}
                {active === 'contracts' && <ContractsSection />}
                {active === 'tokens' && <TokensSection />}
                {active === 'faq' && <FAQSection />}
            </main>
        </div>
    );
}

/* ─── Sections ─── */

function OverviewSection() {
    return (
        <div>
            <h1 style={s.h1}>Thesis Protocol</h1>
            <p style={s.subtitle}>The First Prediction Market Where Positions Become Collateral — Built on Bitcoin L1</p>

            <div style={s.callout}>
                <strong>Testnet Live</strong> &mdash; Thesis Protocol is currently deployed on OP_NET Testnet.
                All tokens are test tokens with no real value.
            </div>

            <h2 style={s.h2}>What is Thesis Protocol?</h2>
            <p style={s.p}>
                Thesis Protocol is the first prediction market with built-in collateralized lending. Trade on
                the outcomes of real-world events by buying YES/NO tokens, then use those tokens as collateral
                to borrow tUSDT — unlocking liquidity without closing your positions.
            </p>
            <p style={s.p}>
                Built natively on Bitcoin Layer 1 using the OP_NET metaprotocol, Thesis eliminates the need
                for bridges, sidechains, or L2s. Your predictions live on Bitcoin with its full security
                guarantees, while OP_NET's smart contract layer enables AMM trading, lending pools, and
                AI-powered market generation.
            </p>

            <h2 style={s.h2}>Key Features</h2>
            <ul style={s.ul}>
                <li style={s.li}><strong>Bitcoin Native:</strong> Runs on Bitcoin L1 via OP_NET &mdash; not a sidechain, not an L2</li>
                <li style={s.li}><strong>AMM Trading:</strong> Constant Product Market Maker (CPMM) for instant token swaps</li>
                <li style={s.li}><strong>Positions as Collateral:</strong> The first prediction market with built-in lending &mdash; borrow tUSDT against your YES/NO tokens (up to 60% LTV)</li>
                <li style={s.li}><strong>AI Oracle:</strong> Bob, an AI agent powered by Claude, predicts every market</li>
                <li style={s.li}><strong>Automated Markets:</strong> New markets generated automatically by AI based on trending topics</li>
                <li style={s.li}><strong>On-Chain Settlement:</strong> All trades and positions are settled on-chain</li>
            </ul>

            <h2 style={s.h2}>How It Works</h2>
            <div style={s.steps}>
                <Step n="01" title="Browse Markets" desc="Explore active prediction markets across categories like crypto, politics, sports, and technology." />
                <Step n="02" title="Buy Tokens" desc="Purchase YES or NO tokens using tUSDT collateral through the AMM. Prices reflect market sentiment." />
                <Step n="03" title="Leverage Positions" desc="Deposit your prediction tokens as collateral in the lending protocol and borrow tUSDT against them." />
                <Step n="04" title="Resolution" desc="When a market resolves, winning tokens are redeemable 1:1 for tUSDT. Losing tokens become worthless." />
            </div>
        </div>
    );
}

function ArchitectureSection() {
    return (
        <div>
            <h1 style={s.h1}>Architecture</h1>

            <h2 style={s.h2}>Technology Stack</h2>
            <table style={s.table}>
                <tbody>
                    <TableRow label="Blockchain" value="Bitcoin L1 via OP_NET Metaprotocol" />
                    <TableRow label="Smart Contracts" value="AssemblyScript compiled to WASM" />
                    <TableRow label="Token Standard" value="OP_20 (ERC-20 equivalent for OP_NET)" />
                    <TableRow label="Frontend" value="React + TypeScript + Vite" />
                    <TableRow label="Backend" value="Node.js + HyperExpress API" />
                    <TableRow label="Database" value="SQLite (better-sqlite3)" />
                    <TableRow label="AI Engine" value="Anthropic Claude via API" />
                    <TableRow label="RPC Node" value="OP_NET Testnet (testnet.opnet.org)" />
                </tbody>
            </table>

            <h2 style={s.h2}>System Components</h2>

            <h3 style={s.h3}>1. Smart Contracts (On-Chain)</h3>
            <p style={s.p}>
                Six interconnected smart contracts form the protocol's on-chain logic:
            </p>
            <ul style={s.ul}>
                <li style={s.li}><strong>PredictionMarket:</strong> CPMM AMM that holds YES/NO reserves and processes trades</li>
                <li style={s.li}><strong>OutcomeToken (YES):</strong> OP_20 token representing a "yes" outcome</li>
                <li style={s.li}><strong>OutcomeToken (NO):</strong> OP_20 token representing a "no" outcome</li>
                <li style={s.li}><strong>MarketFactory:</strong> Registry that links markets, tokens, and metadata</li>
                <li style={s.li}><strong>LendingPool:</strong> Accepts YES/NO tokens as collateral for tUSDT loans</li>
                <li style={s.li}><strong>tUSDT (Collateral):</strong> Test stablecoin used for all market operations</li>
            </ul>

            <h3 style={s.h3}>2. Backend API</h3>
            <p style={s.p}>
                The backend API provides market data, manages the AI oracle, processes the deploy pipeline,
                and maintains user statistics. It also includes a Block Watcher that monitors OP_NET blocks
                and triggers automated market generation.
            </p>

            <h3 style={s.h3}>3. Frontend Application</h3>
            <p style={s.p}>
                A React single-page application that communicates with both the backend API (for market data)
                and the OP_NET RPC node (for on-chain interactions). Users connect their OP_NET-compatible wallet
                to trade, lend, and manage positions.
            </p>

            <h2 style={s.h2}>Deploy Pipeline</h2>
            <p style={s.p}>
                Each new market requires deploying 5 contracts on-chain in sequence. The process is fully automated:
            </p>
            <ol style={s.ol}>
                <li style={s.li}>Deploy YES OutcomeToken (linked to tUSDT collateral)</li>
                <li style={s.li}>Deploy NO OutcomeToken (linked to tUSDT collateral)</li>
                <li style={s.li}>Deploy PredictionMarket (CPMM with initial liquidity)</li>
                <li style={s.li}>Deploy MarketFactory (registry with question, end block, addresses)</li>
                <li style={s.li}>Deploy LendingPool (accepts YES/NO as collateral)</li>
            </ol>
            <p style={s.p}>
                Each step requires on-chain confirmation (~10 minutes per block on OP_NET Testnet), so a full
                market deployment takes approximately 50-90 minutes.
            </p>
        </div>
    );
}

function MarketsSection() {
    return (
        <div>
            <h1 style={s.h1}>Prediction Markets</h1>

            <h2 style={s.h2}>What is a Prediction Market?</h2>
            <p style={s.p}>
                A prediction market is a financial market where participants trade contracts based on the
                outcome of future events. Each market poses a binary question (e.g., "Will Bitcoin reach $200k
                by Q4 2026?"). Traders buy YES or NO tokens based on their predictions.
            </p>

            <h2 style={s.h2}>Market Structure</h2>
            <p style={s.p}>Each market in Thesis Protocol consists of:</p>
            <ul style={s.ul}>
                <li style={s.li}><strong>Question:</strong> A binary yes/no question about a future event</li>
                <li style={s.li}><strong>Category:</strong> Classification (crypto, politics, sports, technology, etc.)</li>
                <li style={s.li}><strong>End Block:</strong> The OP_NET block at which the market can be resolved</li>
                <li style={s.li}><strong>YES Token:</strong> OP_20 token that pays out 1 tUSDT if the answer is YES</li>
                <li style={s.li}><strong>NO Token:</strong> OP_20 token that pays out 1 tUSDT if the answer is NO</li>
                <li style={s.li}><strong>AMM Pool:</strong> Constant Product Market Maker with YES/NO reserves</li>
                <li style={s.li}><strong>Lending Pool:</strong> Allows borrowing tUSDT against YES/NO positions</li>
            </ul>

            <h2 style={s.h2}>Market Lifecycle</h2>
            <div style={s.steps}>
                <Step n="01" title="Creation" desc="AI generates a question based on trending topics. Contracts are deployed on-chain with initial liquidity." />
                <Step n="02" title="Active Trading" desc="Users buy/sell YES and NO tokens. Prices move based on supply/demand via the AMM." />
                <Step n="03" title="Resolution" desc="After the end block, the market is resolved (YES wins or NO wins) by the admin/oracle." />
                <Step n="04" title="Settlement" desc="Winning token holders can redeem 1:1 for tUSDT. Losing tokens become worthless." />
            </div>

            <h2 style={s.h2}>Categories</h2>
            <p style={s.p}>Markets are organized into categories:</p>
            <ul style={s.ul}>
                <li style={s.li}><strong>Crypto:</strong> Bitcoin price, network metrics, protocol milestones</li>
                <li style={s.li}><strong>Technology:</strong> Product launches, AI developments, tech company events</li>
                <li style={s.li}><strong>Politics:</strong> Elections, policy decisions, geopolitical events</li>
                <li style={s.li}><strong>Sports:</strong> Game outcomes, championships, records</li>
                <li style={s.li}><strong>General:</strong> Pop culture, science, weather, and other topics</li>
            </ul>

            <h2 style={s.h2}>AI Predictions</h2>
            <p style={s.p}>
                Every market includes an AI prediction from Bob, the AI oracle. Bob analyzes each question
                using Claude and provides a YES/NO prediction with a confidence percentage and reasoning.
                Bob's track record is visible on the Leaderboard page.
            </p>
        </div>
    );
}

function TradingSection() {
    return (
        <div>
            <h1 style={s.h1}>Trading</h1>

            <h2 style={s.h2}>AMM (Automated Market Maker)</h2>
            <p style={s.p}>
                Thesis Protocol uses a Constant Product Market Maker (CPMM) for pricing, the same formula
                used by Uniswap. The invariant is:
            </p>
            <Code code="YES_reserve * NO_reserve = k (constant)" />
            <p style={s.p}>
                When you buy YES tokens, you add tUSDT to the pool and receive YES tokens. This increases the
                YES price and decreases the NO price. The prices always sum to approximately 1 tUSDT, reflecting
                the probability of each outcome.
            </p>

            <h2 style={s.h2}>Price Mechanics</h2>
            <table style={s.table}>
                <tbody>
                    <TableRow label="YES Price" value="NO_reserve / (YES_reserve + NO_reserve)" />
                    <TableRow label="NO Price" value="YES_reserve / (YES_reserve + NO_reserve)" />
                    <TableRow label="Fee" value="1% per trade (configurable)" />
                    <TableRow label="Min Trade" value="No minimum" />
                    <TableRow label="Slippage" value="Depends on trade size vs pool reserves" />
                </tbody>
            </table>

            <h2 style={s.h2}>How to Trade</h2>
            <ol style={s.ol}>
                <li style={s.li}>Connect your OP_NET wallet</li>
                <li style={s.li}>Navigate to a market from the Markets page</li>
                <li style={s.li}>Choose YES or NO</li>
                <li style={s.li}>Enter the amount of tUSDT to spend</li>
                <li style={s.li}>Review the estimated tokens you'll receive and the price impact</li>
                <li style={s.li}>Confirm the transaction in your wallet</li>
            </ol>

            <h2 style={s.h2}>Selling Tokens</h2>
            <p style={s.p}>
                You can sell your YES or NO tokens back to the AMM at any time before market resolution.
                The sell price depends on the current pool reserves. You receive tUSDT in return.
            </p>

            <h2 style={s.h2}>Getting tUSDT</h2>
            <p style={s.p}>
                On testnet, you can claim free tUSDT from the faucet on the Portfolio page. The faucet
                mints test tokens directly to your wallet address.
            </p>

            <div style={s.callout}>
                <strong>Important:</strong> The <code style={s.code}>increaseAllowance</code> function is used
                instead of <code style={s.code}>approve</code> for OP_20 tokens. This is a key difference
                from ERC-20 on Ethereum.
            </div>
        </div>
    );
}

function LendingSection() {
    return (
        <div>
            <h1 style={s.h1}>Lending & Borrowing</h1>

            <h2 style={s.h2}>Overview</h2>
            <p style={s.p}>
                Thesis Protocol includes a built-in lending protocol that allows users to borrow tUSDT
                against their prediction market positions. This enables capital efficiency &mdash; instead of
                locking up capital in a prediction, you can borrow against it and use the proceeds elsewhere.
            </p>

            <h2 style={s.h2}>Parameters</h2>
            <table style={s.table}>
                <tbody>
                    <TableRow label="Collateral" value="YES or NO outcome tokens" />
                    <TableRow label="Borrow Asset" value="tUSDT (test stablecoin)" />
                    <TableRow label="Max LTV" value="60% (loan-to-value ratio)" />
                    <TableRow label="Interest Rate" value="Variable, based on utilization" />
                    <TableRow label="Liquidation" value="Triggered when position value drops below threshold" />
                </tbody>
            </table>

            <h2 style={s.h2}>Operations</h2>

            <h3 style={s.h3}>Deposit Collateral</h3>
            <p style={s.p}>
                Deposit your YES or NO tokens into the LendingPool contract. You can deposit any amount
                and mix YES and NO tokens as collateral.
            </p>

            <h3 style={s.h3}>Borrow tUSDT</h3>
            <p style={s.p}>
                Once you have collateral deposited, you can borrow up to 60% of its value in tUSDT.
                The maximum borrow amount is calculated based on the current market price of your collateral tokens.
            </p>

            <h3 style={s.h3}>Repay Loans</h3>
            <p style={s.p}>
                Repay your borrowed tUSDT plus accrued interest to unlock your collateral. Partial repayment
                is supported &mdash; you can repay any amount up to the full debt.
            </p>

            <h3 style={s.h3}>Withdraw Collateral</h3>
            <p style={s.p}>
                After repaying your loan, withdraw your deposited collateral tokens. You cannot withdraw
                if it would bring your position below the minimum collateral ratio.
            </p>

            <h2 style={s.h2}>Quick Amount Buttons</h2>
            <p style={s.p}>
                The lending interface provides 25%, 50%, 75%, and MAX buttons for quick amount selection.
                The MAX value depends on the operation:
            </p>
            <ul style={s.ul}>
                <li style={s.li}><strong>Deposit MAX:</strong> Your full YES or NO token balance</li>
                <li style={s.li}><strong>Borrow MAX:</strong> Maximum borrowable amount based on collateral</li>
                <li style={s.li}><strong>Repay MAX:</strong> Your outstanding debt or tUSDT balance (whichever is less)</li>
                <li style={s.li}><strong>Withdraw MAX:</strong> Your deposited collateral amount</li>
            </ul>
        </div>
    );
}

function AISection() {
    return (
        <div>
            <h1 style={s.h1}>AI Oracle &mdash; Bob</h1>

            <h2 style={s.h2}>Who is Bob?</h2>
            <p style={s.p}>
                Bob is Thesis Protocol's AI oracle agent. Powered by Anthropic's Claude, Bob serves two
                critical roles in the protocol:
            </p>
            <ol style={s.ol}>
                <li style={s.li}><strong>Market Generation:</strong> Bob automatically creates new prediction markets based on trending real-world events</li>
                <li style={s.li}><strong>Market Prediction:</strong> Bob provides a YES/NO prediction with confidence score and reasoning for every market</li>
            </ol>

            <h2 style={s.h2}>Market Generation Process</h2>
            <p style={s.p}>
                The backend runs a Block Watcher that monitors OP_NET blocks. Every 10 blocks
                (~100 minutes), if all previous markets are deployed and under the cap of 15 active markets,
                Bob generates a new market question.
            </p>
            <p style={s.p}>Bob's generation criteria:</p>
            <ul style={s.ul}>
                <li style={s.li}>Questions must be verifiable and binary (YES/NO answer)</li>
                <li style={s.li}>Questions must have a clear resolution date</li>
                <li style={s.li}>Questions must not duplicate existing markets (case-insensitive DB check)</li>
                <li style={s.li}>Topics are diverse: crypto, politics, tech, sports, world events</li>
                <li style={s.li}>Questions should be timely and engaging for traders</li>
            </ul>

            <h2 style={s.h2}>Prediction Methodology</h2>
            <p style={s.p}>
                For each market, Bob analyzes the question using Claude's reasoning capabilities and provides:
            </p>
            <ul style={s.ul}>
                <li style={s.li}><strong>Outcome:</strong> YES (1) or NO (2)</li>
                <li style={s.li}><strong>Confidence:</strong> 0-100% confidence score</li>
                <li style={s.li}><strong>Reasoning:</strong> Detailed explanation of the prediction logic</li>
            </ul>

            <h2 style={s.h2}>Leaderboard</h2>
            <p style={s.p}>
                Bob's predictions are tracked on the Leaderboard alongside human traders. You can see
                Bob's accuracy, win streak, and compare performance against the community. Bob trades
                under the identifier "bob-ai".
            </p>

            <div style={s.callout}>
                <strong>Note:</strong> Bob's predictions are for informational purposes. The AI can be wrong.
                Always do your own research before trading.
            </div>
        </div>
    );
}

function ContractsSection() {
    return (
        <div>
            <h1 style={s.h1}>Smart Contracts</h1>

            <h2 style={s.h2}>Contract Overview</h2>
            <p style={s.p}>
                All smart contracts are written in AssemblyScript and compiled to WASM for execution on
                the OP_NET virtual machine. Contracts follow the OP_20 token standard where applicable.
            </p>

            <h3 style={s.h3}>PredictionMarket</h3>
            <p style={s.p}>
                The core AMM contract. Implements a CPMM (Constant Product Market Maker) with YES and NO
                token reserves. Key functions:
            </p>
            <ul style={s.ul}>
                <li style={s.li}><code style={s.code}>buyOutcome(side, amount)</code> &mdash; Buy YES or NO tokens with tUSDT</li>
                <li style={s.li}><code style={s.code}>sellOutcome(side, amount)</code> &mdash; Sell YES or NO tokens for tUSDT</li>
                <li style={s.li}><code style={s.code}>getPrice(side)</code> &mdash; Get current price of YES or NO tokens</li>
                <li style={s.li}><code style={s.code}>getReserves()</code> &mdash; Get current pool reserves</li>
            </ul>

            <h3 style={s.h3}>OutcomeToken (OP_20)</h3>
            <p style={s.p}>
                Standard OP_20 tokens representing YES or NO outcomes. Each market has two OutcomeToken contracts.
                Tokens are minted to the PredictionMarket contract on deploy and distributed through trades.
            </p>

            <h3 style={s.h3}>MarketFactory</h3>
            <p style={s.p}>
                Registry contract that stores market metadata: the question, end block, token addresses,
                and market address. Acts as the single source of truth for market configuration.
            </p>

            <h3 style={s.h3}>LendingPool</h3>
            <p style={s.p}>
                Accepts YES/NO tokens as collateral and issues tUSDT loans. Implements:
            </p>
            <ul style={s.ul}>
                <li style={s.li}><code style={s.code}>deposit(tokenType, amount)</code> &mdash; Deposit collateral</li>
                <li style={s.li}><code style={s.code}>borrow(amount)</code> &mdash; Borrow tUSDT against collateral</li>
                <li style={s.li}><code style={s.code}>repay(amount)</code> &mdash; Repay borrowed tUSDT</li>
                <li style={s.li}><code style={s.code}>withdraw(tokenType, amount)</code> &mdash; Withdraw collateral</li>
            </ul>

            <h2 style={s.h2}>Network Details</h2>
            <table style={s.table}>
                <tbody>
                    <TableRow label="Network" value="OP_NET Testnet" />
                    <TableRow label="RPC" value="https://testnet.opnet.org" />
                    <TableRow label="Block Explorer" value="https://opscan.org" />
                    <TableRow label="Block Time" value="~10 minutes" />
                    <TableRow label="Address Format" value="Bech32 (opt1...)" />
                </tbody>
            </table>
        </div>
    );
}

function TokensSection() {
    return (
        <div>
            <h1 style={s.h1}>Token Standard</h1>

            <h2 style={s.h2}>OP_20 Standard</h2>
            <p style={s.p}>
                OP_20 is the fungible token standard on OP_NET, analogous to ERC-20 on Ethereum. All tokens
                in Thesis Protocol (tUSDT, YES tokens, NO tokens) follow this standard.
            </p>

            <h2 style={s.h2}>Key Differences from ERC-20</h2>
            <div style={s.callout}>
                <strong>Important:</strong> OP_20 uses <code style={s.code}>increaseAllowance</code> and{' '}
                <code style={s.code}>decreaseAllowance</code> instead of <code style={s.code}>approve</code>.
                This is a critical implementation detail.
            </div>
            <ul style={s.ul}>
                <li style={s.li}>No <code style={s.code}>approve()</code> function &mdash; use <code style={s.code}>increaseAllowance()</code> instead</li>
                <li style={s.li}>Token addresses use Bech32 format (<code style={s.code}>opt1...</code>)</li>
                <li style={s.li}>Transactions are signed via the OP_NET wallet extension</li>
                <li style={s.li}>Balances are <code style={s.code}>u256</code> with 18 decimals (same as ERC-20)</li>
            </ul>

            <h2 style={s.h2}>Core Functions</h2>
            <table style={s.table}>
                <tbody>
                    <TableRow label="balanceOf(address)" value="Returns token balance" />
                    <TableRow label="transfer(to, amount)" value="Transfer tokens to another address" />
                    <TableRow label="increaseAllowance(spender, amount)" value="Increase spending allowance" />
                    <TableRow label="decreaseAllowance(spender, amount)" value="Decrease spending allowance" />
                    <TableRow label="allowance(owner, spender)" value="Check current allowance" />
                    <TableRow label="totalSupply()" value="Total token supply" />
                </tbody>
            </table>

            <h2 style={s.h2}>tUSDT (Test USDT)</h2>
            <p style={s.p}>
                tUSDT is the collateral token used throughout Thesis Protocol. On testnet, it can be obtained
                from the faucet on the Portfolio page. tUSDT has 18 decimals and is used for:
            </p>
            <ul style={s.ul}>
                <li style={s.li}>Buying YES/NO tokens in prediction markets</li>
                <li style={s.li}>Receiving proceeds from selling prediction tokens</li>
                <li style={s.li}>Borrowing against deposited collateral in lending pools</li>
                <li style={s.li}>Repaying loans and interest</li>
            </ul>
        </div>
    );
}

function FAQSection() {
    return (
        <div>
            <h1 style={s.h1}>FAQ</h1>

            <FAQ q="What wallet do I need?" a="You need an OP_NET-compatible wallet browser extension. Connect it using the 'Connect Wallet' button in the header. The wallet handles all transaction signing." />
            <FAQ q="Is this on Bitcoin mainnet?" a="No. Thesis Protocol is currently on OP_NET Testnet. All tokens are test tokens with no real value. Mainnet deployment is planned for the future." />
            <FAQ q="How do I get test tokens?" a="Visit the Portfolio page and use the tUSDT Faucet to claim free test tokens. The faucet mints tUSDT directly to your wallet." />
            <FAQ q="What is OP_NET?" a="OP_NET is a Bitcoin L1 metaprotocol that enables smart contracts on Bitcoin. It uses AssemblyScript contracts compiled to WASM, with its own token standard (OP_20) and transaction format." />
            <FAQ q="How are markets resolved?" a="Markets are currently resolved by the admin after the end block is reached. Decentralized oracle resolution is planned for future versions." />
            <FAQ q="What happens if I hold losing tokens?" a="When a market resolves, winning tokens can be redeemed 1:1 for tUSDT. Losing tokens become worthless (value goes to 0)." />
            <FAQ q="Can I get liquidated?" a="Yes. If you borrow tUSDT against your prediction tokens and the value of your collateral drops below the liquidation threshold, your position can be liquidated." />
            <FAQ q="Who is Bob?" a="Bob is the AI oracle agent powered by Anthropic's Claude. Bob generates new markets based on trending events and provides AI predictions (YES/NO with confidence) for every market." />
            <FAQ q="How does the AMM work?" a="Thesis uses a Constant Product Market Maker (YES * NO = k). When you buy YES tokens, the YES price increases and NO price decreases. Prices always approximately sum to 1 tUSDT." />
            <FAQ q="What is the trading fee?" a="The default trading fee is 1% per trade. Fees go to the liquidity pool to maintain market stability." />
            <FAQ q="How long does market deployment take?" a="Each market requires 5 contract deployments on-chain. With ~10 minute block times on testnet, full deployment takes 50-90 minutes." />
            <FAQ q="Can I create my own market?" a="Currently, markets are auto-generated by the AI oracle. User-created markets may be supported in future versions." />
        </div>
    );
}

/* ─── Shared Components ─── */

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
    return (
        <div style={s.step}>
            <div style={s.stepNum}>{n}</div>
            <h3 style={s.stepTitle}>{title}</h3>
            <p style={s.stepDesc}>{desc}</p>
        </div>
    );
}

function TableRow({ label, value }: { label: string; value: string }) {
    return (
        <tr>
            <td style={s.td}>{label}</td>
            <td style={{ ...s.td, color: '#f0ede6' }}>{value}</td>
        </tr>
    );
}

function Code({ code }: { code: string }) {
    return (
        <pre style={s.pre}><code>{code}</code></pre>
    );
}

function FAQ({ q, a }: { q: string; a: string }) {
    return (
        <div style={s.faqItem}>
            <h3 style={s.faqQ}>{q}</h3>
            <p style={s.faqA}>{a}</p>
        </div>
    );
}

/* ─── Styles ─── */

const s: Record<string, CSSProperties> = {
    page: {
        display: 'grid',
        gridTemplateColumns: '240px 1fr',
        gap: 48,
        padding: '48px 0',
        minHeight: 'calc(100vh - 200px)',
    },
    sidebar: {
        position: 'sticky' as const,
        top: 80,
        alignSelf: 'start' as const,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 2,
        borderRight: '1px solid rgba(245,200,66,0.08)',
        paddingRight: 24,
    },
    sidebarTitle: {
        fontSize: 11,
        letterSpacing: '0.16em',
        color: '#f5c842',
        textTransform: 'uppercase' as const,
        marginBottom: 16,
        fontFamily: "'DM Mono', monospace",
    },
    sidebarLink: {
        display: 'block',
        padding: '8px 16px',
        fontSize: 12,
        fontFamily: "'DM Mono', monospace",
        color: '#6b6b5e',
        background: 'transparent',
        border: 'none',
        textAlign: 'left' as const,
        cursor: 'pointer',
        letterSpacing: '0.04em',
        borderLeft: '2px solid transparent',
    },
    sidebarActive: {
        color: '#f5c842',
        borderLeftColor: '#f5c842',
        background: 'rgba(245,200,66,0.04)',
    },
    content: {
        maxWidth: 720,
    },
    h1: {
        fontFamily: "'Syne', sans-serif",
        fontSize: 36,
        fontWeight: 800,
        color: '#f0ede6',
        letterSpacing: '-0.03em',
        marginBottom: 8,
    },
    h2: {
        fontFamily: "'Syne', sans-serif",
        fontSize: 20,
        fontWeight: 700,
        color: '#f0ede6',
        letterSpacing: '-0.02em',
        marginTop: 40,
        marginBottom: 12,
    },
    h3: {
        fontFamily: "'Syne', sans-serif",
        fontSize: 15,
        fontWeight: 700,
        color: '#f5c842',
        marginTop: 24,
        marginBottom: 8,
    },
    subtitle: {
        fontFamily: "'DM Mono', monospace",
        fontSize: 14,
        color: '#6b6b5e',
        marginBottom: 32,
    },
    p: {
        fontFamily: "'DM Mono', monospace",
        fontSize: 12,
        color: '#9a9a8e',
        lineHeight: 1.8,
        marginBottom: 16,
    },
    ul: {
        paddingLeft: 20,
        marginBottom: 16,
    },
    ol: {
        paddingLeft: 20,
        marginBottom: 16,
    },
    li: {
        fontFamily: "'DM Mono', monospace",
        fontSize: 12,
        color: '#9a9a8e',
        lineHeight: 1.8,
        marginBottom: 4,
    },
    callout: {
        padding: '16px 20px',
        background: 'rgba(245,200,66,0.04)',
        border: '1px solid rgba(245,200,66,0.15)',
        fontFamily: "'DM Mono', monospace",
        fontSize: 12,
        color: '#9a9a8e',
        lineHeight: 1.7,
        marginBottom: 24,
    },
    code: {
        fontFamily: "'DM Mono', monospace",
        fontSize: 11,
        background: 'rgba(245,200,66,0.06)',
        padding: '2px 6px',
        color: '#f5c842',
    },
    pre: {
        background: '#111110',
        border: '1px solid rgba(245,200,66,0.1)',
        padding: '16px 20px',
        fontFamily: "'DM Mono', monospace",
        fontSize: 12,
        color: '#f5c842',
        marginBottom: 16,
        overflowX: 'auto' as const,
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse' as const,
        marginBottom: 24,
    },
    td: {
        padding: '10px 16px',
        borderBottom: '1px solid rgba(245,200,66,0.06)',
        fontFamily: "'DM Mono', monospace",
        fontSize: 12,
        color: '#6b6b5e',
    },
    steps: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 2,
        marginTop: 16,
        marginBottom: 24,
    },
    step: {
        background: '#111110',
        border: '1px solid rgba(245,200,66,0.1)',
        padding: 24,
    },
    stepNum: {
        fontFamily: "'Syne', sans-serif",
        fontSize: 36,
        fontWeight: 800,
        color: 'rgba(245,200,66,0.1)',
        lineHeight: 1,
        marginBottom: 12,
    },
    stepTitle: {
        fontFamily: "'Syne', sans-serif",
        fontSize: 14,
        fontWeight: 700,
        color: '#f0ede6',
        marginBottom: 8,
    },
    stepDesc: {
        fontFamily: "'DM Mono', monospace",
        fontSize: 11,
        color: '#6b6b5e',
        lineHeight: 1.6,
    },
    faqItem: {
        borderBottom: '1px solid rgba(245,200,66,0.06)',
        padding: '20px 0',
    },
    faqQ: {
        fontFamily: "'Syne', sans-serif",
        fontSize: 14,
        fontWeight: 700,
        color: '#f0ede6',
        marginBottom: 8,
    },
    faqA: {
        fontFamily: "'DM Mono', monospace",
        fontSize: 12,
        color: '#9a9a8e',
        lineHeight: 1.7,
    },
};
