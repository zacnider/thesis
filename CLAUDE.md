# CLAUDE.md -- Thesis Protocol: AI-Powered Prediction Market on Bitcoin L1

## Project Description

Full-stack prediction market built on Bitcoin Layer 1 with OP_NET. AI oracle resolution + CPMM AMM + collateralized lending.

## Structure

```
/contracts     -- 6 smart contracts (AssemblyScript → WASM)
/frontend      -- React + Vite + TypeScript
/backend       -- hyper-express API server
/shared        -- Shared types and constants
```

## Package Rules

### ALWAYS Use
- `@btc-vision/bitcoin` -- Bitcoin library (OPNet fork)
- `@btc-vision/transaction` -- Transaction construction and ABI types
- `opnet` -- OPNet SDK, provider, contract interaction
- `@btc-vision/btc-runtime` -- Smart contract runtime (contracts only)
- `@btc-vision/walletconnect` -- Wallet connection modal (frontend only)
- `hyper-express` -- Backend framework

### NEVER Use
- `bitcoinjs-lib`, `ecpair`, `tiny-secp256k1`
- `ethers`, `web3`
- `express`, `fastify`, `koa`
- `@metamask/sdk`, `window.ethereum`

## Smart Contract Rules

- SafeMath for ALL u256 arithmetic
- No `while` loops
- `onDeployment()` for one-time init, constructor only calls `super()`
- Unique storage pointers

## Frontend Rules

- `@btc-vision/walletconnect` with WalletConnect popup CSS fix (MANDATORY)
- Separate `JSONRpcProvider` for reads, WalletConnect provider for signing only
- `signer: null, mldsaSigner: null` on all frontend transactions
- `getContract<T>()` from opnet for contract interaction
- Brutalist dark theme (Syne + DM Mono fonts, gold accent #f5c842)

## Backend Rules

- hyper-express ONLY
- `JSONRpcProvider` from opnet for chain data
- Real signers via env vars (`MNEMONIC`)
- `.env` in `.gitignore`
- AI auto-generates markets every 20 blocks

## Deployed Contracts (Testnet)

- MarketFactory: `opt1sqrta4vn7kv30u4zfm3avqy66qfjnzlr36glk9n3y`
- OracleResolver: `opt1sqr93erwvhgdk9rpl7y3pncq6c9n85she3g78xfhj`
- ReputationTracker: `opt1sqzr36zm92pfcwx2aytxcywyrj6yg7k8cdqadxmcj`

## Server

- IP: 94.154.34.131
- Domains: thesisprotocol.org, prophetbt.cc
- Frontend: /opt/prophet/frontend/dist/
- Backend: /opt/prophet/backend/ (pm2: prophet-api)
