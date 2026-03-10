# THESIS PROTOCOL Security Audit Report

## Architecture Overview
Thesis Protocol is the first prediction market with AI oracle resolution and collateralized outcome-token lending on Bitcoin L1 via OP_NET. It consists of 6 smart contracts, a backend API, and a React frontend.

## Smart Contract Security

### 1. PredictionMarket.ts (CPMM AMM Core)

**SafeMath** — All arithmetic operations use `SafeMath.add()`, `SafeMath.sub()`, `SafeMath.mul()`, `SafeMath.div()` to prevent overflow/underflow with u256 values.

**CEI Pattern (Checks-Effects-Interactions)** — Each method follows:
1. Input validation (checks)
2. State updates (effects)
3. External calls via TransferHelper (interactions)

**Access Control:**
- `resolve()` — Owner-only, validated with `sender !== this.owner.value`
- `setFeeRate()` — Owner-only, max 500 bps (5%) hard cap
- `withdrawFees()` — Owner-only

**Market State:**
- Trading blocked after resolution (`this.resolved.value` check)
- Outcome validation: only 1 (YES) or 2 (NO) accepted
- Zero amount protection on all trade functions

**CPMM Invariant:**
- `k = YES_reserve * NO_reserve` maintained through buy/sell
- Price derived from reserves: `yesPrice = noReserve / (yesReserve + noReserve)`
- Division by zero protected: reserves initialized to non-zero in `onDeployment`

**Fee System:**
- Fees deducted before AMM calculation (buy) or after (sell)
- Accumulated in contract, withdrawable only by owner
- Max fee rate enforced at 500 bps

### 2. OutcomeToken.ts (OP20)

**Token Supply:**
- All tokens minted to deployer in `onDeployment`
- Immediately transferred to market contract
- No additional mint capability (inherits OP20, no custom mint)

**Market Binding:**
- `marketAddress` stored on deployment, immutable after

### 3. MarketFactory.ts (Registry)

**Sequential IDs:**
- Markets assigned auto-incrementing IDs via `marketCount`
- Bounds checking: `marketId >= marketCount` reverts

**Storage:**
- Uses `encodePointerUnknownLength` for dynamic mapping
- Active status tracked per market

**Access Control:**
- `registerMarket()`, `markResolved()`, `transferOwnership()` — Owner-only

### 4. OracleResolver.ts (Dispute Resolution)

**Bond Mechanism:**
- Proposer posts bond >= minimum
- Disputer must post 2x original bond
- 100-block challenge period before finalization

**State Machine:**
- NONE → PROPOSED → (DISPUTED →) FINALIZED
- No state can be skipped
- Challenge period enforced via block number comparison

**Fund Safety:**
- On finalize: winner gets both bonds (if disputed) or proposer gets bond back (if not disputed)
- Emergency resolve: owner refunds all existing bonds before override
- No funds locked — all paths return bonds

### 5. ReputationTracker.ts (Stats)

**Owner-only recording** — Only the owner (backend) can record predictions and resolutions, preventing manipulation.

**Streak Logic:**
- Win streak reset to 0 on incorrect prediction
- Best streak only updated when current exceeds best (monotonically increasing)

### 6. LendingPool.ts (Collateralized Lending)

**Collateral Management:**
- Users deposit YES/NO tokens as collateral
- LTV ratio enforced on-chain (configurable, stored as basis points)
- Interest rate stored as basis points, accrued on borrowed amount

**Access Control:**
- Pool parameters (LTV, interest rate) set at deployment
- Owner-only resolution functions

**Position Safety:**
- `getPositionInfo()` returns full position state per user
- Borrowed amount cannot exceed `maxBorrow` (collateral * LTV)

## General Security Properties

### No Unbounded Loops
All contracts use fixed-iteration operations. No while loops, no unbounded array iterations.

### No Floating Point
All math uses u256 integer arithmetic with SafeMath. Precision maintained via PRECISION constant (10^18).

### No Re-entrancy Risk
OP_NET executes contracts sequentially. TransferHelper calls are atomic within the transaction context.

### Storage Isolation
Each storage pointer uses `Blockchain.nextPointer` for unique allocation. Dynamic maps use `encodePointerUnknownLength` with unique base pointers.

### Constructor Safety
All constructors only call `super()`. Initialization happens in `onDeployment()` which runs exactly once.

## Known Limitations

1. **Oracle Trust** — Resolution ultimately depends on owner/AI oracle. Mitigation: bond-based dispute mechanism with 100-block challenge period.
2. **Front-running** — OP_NET block ordering may allow front-running of large trades. Mitigation: fee mechanism reduces profitability of sandwich attacks.
3. **CPMM Slippage** — Large trades relative to reserves cause significant price impact. Frontend shows estimated slippage via on-chain `getQuote`.
4. **Single Collateral** — Each market uses one collateral token set at deployment. Cannot be changed after.

## Conclusion
The Thesis Protocol smart contracts follow established security patterns (SafeMath, CEI, access control, bounded operations) appropriate for the OP_NET runtime environment. The bond-based oracle dispute mechanism provides economic security for market resolution.
