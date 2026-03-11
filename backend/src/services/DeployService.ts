/**
 * DeployService - Deploys per-market contracts on OP_NET testnet
 *
 * Flow per market (6 steps):
 *   1. Deploy PredictionMarket (without token addresses) → wait for confirmation
 *   2. Deploy YES OutcomeToken (with real market address) → tokens auto-transfer to market
 *   3. Deploy NO OutcomeToken  (with real market address) → tokens auto-transfer to market
 *   4. Call setTokenAddresses on PredictionMarket → link YES/NO tokens
 *   5. Register in MarketFactory via interaction → wait for confirmation
 *   6. Deploy LendingPool → wait for block confirmation
 *
 * Also handles one-time tUSDT collateral token deployment + faucet transfers.
 */
import {
    Address,
    AddressTypes,
    BinaryWriter,
    IDeploymentParameters,
    IInteractionParameters,
    TransactionFactory,
    Mnemonic,
    MLDSASecurityLevel,
} from '@btc-vision/transaction';
import { JSONRpcProvider } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const TESTNET_RPC = process.env.RPC_URL || 'https://testnet.opnet.org';
const network = (networks as any).opnetTestnet;

const TOKEN_DECIMALS = 18;
const TOKEN_SUPPLY = 1000000000n * (10n ** 18n);
const TUSDT_MAX_SUPPLY = 1000000000n * (10n ** 18n); // 1B max (minted on demand via faucet)
const DEFAULT_INITIAL_LIQUIDITY = 1000n * (10n ** 18n);
const DEFAULT_FEE_RATE = 100n;
const REGISTER_MARKET_SELECTOR = 0xba6fdddb;
const SET_TOKEN_ADDRESSES_SELECTOR = 0x664aef3f;
const ADMIN_MINT_SELECTOR = 0x6272783d; // adminMint(address,uint256) — SHA-256 (OP_NET)
const LENDING_POOL_FUND_AMOUNT = 50000n * (10n ** 18n); // Her pool'a 50K tUSDT fonla
const POLL_INTERVAL_MS = 15000;
const MAX_WAIT_MS = 3600000; // 60 min per step — testnet blocks can be slow

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

export interface DeployStatus {
    status: 'idle' | 'deploying_market' | 'deploying_yes_token' | 'deploying_no_token' | 'setting_tokens' | 'registering' | 'deploying_lending_pool' | 'complete' | 'failed';
    step: number;
    totalSteps: number;
    stepLabel: string;
    marketId?: number;
    yesTokenAddress?: string;
    yesTokenPubKey?: string;
    noTokenAddress?: string;
    noTokenPubKey?: string;
    marketAddress?: string;
    marketPubKey?: string;
    lendingPoolAddress?: string;
    lendingPoolPubKey?: string;
    error?: string;
    startedAt: number;
    elapsedSec: number;
}

interface CollateralTokenInfo {
    address: string;
    pubKey: string;
}

class DeployService {
    private factory: TransactionFactory;
    private provider: JSONRpcProvider;
    private wallet: any;
    private account: any;
    private initialized = false;
    private deploying = false;
    private deployStatus: DeployStatus = {
        status: 'idle', step: 0, totalSteps: 5, stepLabel: '',
        startedAt: 0, elapsedSec: 0,
    };

    // tUSDT collateral token
    private collateralTokenAddress = '';
    private collateralTokenPubKey = '';
    private deployingCollateral = false;

    constructor() {
        this.factory = new TransactionFactory();
        this.provider = new JSONRpcProvider({ url: TESTNET_RPC, network });
    }

    async init(): Promise<boolean> {
        const mnemonic = process.env.MNEMONIC;
        if (!mnemonic) {
            console.error('[DeployService] MNEMONIC not set');
            return false;
        }
        try {
            this.wallet = new Mnemonic(mnemonic, '', network, MLDSASecurityLevel.LEVEL2);
            this.account = this.wallet.deriveOPWallet(AddressTypes.P2TR, 0);
            this.initialized = true;
            console.log('[DeployService] Wallet initialized');

            // Load saved tUSDT address
            this.loadCollateralToken();

            return true;
        } catch (err) {
            console.error('[DeployService] Failed to init wallet:', err);
            return false;
        }
    }

    // ========================================
    // Collateral Token (tUSDT) Management
    // ========================================

    private getCollateralTokenFile(): string {
        const currentDir = path.dirname(fileURLToPath(import.meta.url));
        return path.resolve(currentDir, '..', '..', 'data', 'collateral-token.json');
    }

    private loadCollateralToken(): void {
        try {
            const filePath = this.getCollateralTokenFile();
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                this.collateralTokenAddress = data.address || '';
                this.collateralTokenPubKey = data.pubKey || '';
                if (this.collateralTokenAddress) {
                    console.log(`[DeployService] tUSDT loaded: ${this.collateralTokenAddress}`);
                }
            }
        } catch (err) {
            console.error('[DeployService] Failed to load collateral token:', err);
        }
    }

    private saveCollateralToken(): void {
        try {
            const filePath = this.getCollateralTokenFile();
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify({
                address: this.collateralTokenAddress,
                pubKey: this.collateralTokenPubKey,
            }, null, 2));
        } catch (err) {
            console.error('[DeployService] Failed to save collateral token:', err);
        }
    }

    getCollateralInfo(): CollateralTokenInfo {
        return { address: this.collateralTokenAddress, pubKey: this.collateralTokenPubKey };
    }

    hasCollateralToken(): boolean {
        return !!(this.collateralTokenAddress && this.collateralTokenPubKey);
    }

    isDeployingCollateral(): boolean {
        return this.deployingCollateral;
    }

    /**
     * Deploy tUSDT collateral token (one-time).
     * Uses FaucetToken WASM — no initial mint, users call faucet() to get 1 tUSDT each.
     */
    async deployCollateralToken(): Promise<CollateralTokenInfo> {
        if (this.hasCollateralToken()) {
            console.log('[DeployService] tUSDT already deployed:', this.collateralTokenAddress);
            return this.getCollateralInfo();
        }
        if (this.deployingCollateral) {
            throw new Error('tUSDT deployment already in progress');
        }
        if (!this.initialized) {
            throw new Error('DeployService not initialized');
        }

        this.deployingCollateral = true;
        try {
            const tokenWasm = this.getWasmPath('FaucetToken');
            if (!fs.existsSync(tokenWasm)) throw new Error('FaucetToken.wasm not found for tUSDT deploy');

            const tokenBytecode = fs.readFileSync(tokenWasm);

            console.log('[DeployService] Deploying tUSDT (FaucetToken)...');

            const utxos = await this.getFreshUtxos('tUSDT');

            const calldata = new BinaryWriter();
            calldata.writeStringWithLength('Test USDT');
            calldata.writeStringWithLength('tUSDT');
            calldata.writeU256(TUSDT_MAX_SUPPLY);
            calldata.writeU8(TOKEN_DECIMALS);

            const challenge = await this.provider.getChallenge();
            const deploy = await this.factory.signDeployment({
                from: this.account.p2tr, utxos,
                signer: this.account.keypair, mldsaSigner: this.account.mldsaKeypair,
                network, feeRate: 5, priorityFee: 0n, gasSatFee: 10000n,
                bytecode: tokenBytecode, calldata: calldata.getBuffer(),
                challenge,
                linkMLDSAPublicKeyToAddress: true, revealMLDSAPublicKey: true,
            } as IDeploymentParameters);

            this.collateralTokenAddress = deploy.contractAddress;
            this.collateralTokenPubKey = deploy.contractPubKey;

            console.log('[DeployService] tUSDT address:', this.collateralTokenAddress);
            console.log('[DeployService] tUSDT pubKey:', this.collateralTokenPubKey);

            await this.provider.sendRawTransaction(deploy.transaction[0], false);
            await this.provider.sendRawTransaction(deploy.transaction[1], false);

            console.log('[DeployService] Waiting for tUSDT confirmation...');
            await this.waitForContractDeployment(this.collateralTokenAddress, 'tUSDT');

            // Save to file
            this.saveCollateralToken();
            console.log('[DeployService] tUSDT (FaucetToken) deployed and saved!');

            this.deployingCollateral = false;
            return this.getCollateralInfo();
        } catch (err) {
            this.deployingCollateral = false;
            throw err;
        }
    }

    // ========================================
    // Core Deploy Methods
    // ========================================

    private getWasmPath(contractName: string): string {
        const currentDir = path.dirname(fileURLToPath(import.meta.url));
        return path.resolve(currentDir, '..', '..', '..', 'contracts', 'build', `${contractName}.wasm`);
    }

    private updateStatus(partial: Partial<DeployStatus>): void {
        Object.assign(this.deployStatus, partial);
        if (this.deployStatus.startedAt > 0) {
            this.deployStatus.elapsedSec = Math.round((Date.now() - this.deployStatus.startedAt) / 1000);
        }
    }

    private async waitForContractDeployment(contractAddress: string, label: string): Promise<void> {
        const start = Date.now();
        let attempt = 0;
        while (Date.now() - start < MAX_WAIT_MS) {
            attempt++;
            await sleep(POLL_INTERVAL_MS);
            this.updateStatus({});
            try {
                const code = await this.provider.getCode(contractAddress, true);
                if (code && (code as Uint8Array).length > 0) {
                    console.log(`[DeployService] ${label} confirmed (${Math.round((Date.now() - start) / 1000)}s)`);
                    return;
                }
            } catch (err: any) {
                const msg = err.message || '';
                if (!msg.includes('not found')) {
                    console.log(`[DeployService] ${label} getCode error: ${msg}`);
                }
            }
            console.log(`[DeployService] ${label} waiting... (${Math.round((Date.now() - start) / 1000)}s, attempt ${attempt})`);
        }
        throw new Error(`${label}: timed out (${MAX_WAIT_MS / 1000}s)`);
    }

    private async waitForTxConfirmation(txHash: string, label: string): Promise<void> {
        const start = Date.now();
        let attempt = 0;
        while (Date.now() - start < MAX_WAIT_MS) {
            attempt++;
            await sleep(POLL_INTERVAL_MS);
            this.updateStatus({});
            try {
                const receipt = await this.provider.getTransactionReceipt(txHash);
                if (receipt) {
                    console.log(`[DeployService] ${label} TX confirmed (${Math.round((Date.now() - start) / 1000)}s)`);
                    return;
                }
            } catch (err: any) {
                const msg = err.message || '';
                if (!msg.includes('not found') && !msg.includes('Could not find') && !msg.includes('Cannot read properties of undefined')) {
                    console.log(`[DeployService] ${label} receipt error: ${msg}`);
                }
            }
        }
        throw new Error(`${label}: TX confirmation timed out`);
    }

    private async getFreshUtxos(label: string): Promise<any[]> {
        for (let i = 0; i < 5; i++) {
            try {
                const utxos = await this.provider.utxoManager.getUTXOs({ address: this.account.p2tr });
                if (utxos && utxos.length > 0) return utxos;
            } catch {}
            console.log(`[DeployService] ${label} waiting for UTXOs...`);
            await sleep(5000);
        }
        throw new Error(`${label}: No UTXOs available`);
    }

    getDeployerAddress(): string {
        return this.account?.p2tr || '';
    }

    isDeploying(): boolean {
        return this.deploying;
    }

    getStatus(): DeployStatus {
        if (this.deployStatus.startedAt > 0 && this.deploying) {
            this.deployStatus.elapsedSec = Math.round((Date.now() - this.deployStatus.startedAt) / 1000);
        }
        return { ...this.deployStatus };
    }

    startDeploy(params: {
        marketId: number;
        question: string;
        endBlock: number;
        collateralToken: string;
        initialLiquidity: string;
        feeRate: number;
    }): { started: boolean; error?: string } {
        if (!this.initialized) {
            return { started: false, error: 'DeployService not initialized' };
        }
        if (this.deploying) {
            return { started: false, error: 'Another deployment in progress' };
        }
        if (!this.hasCollateralToken()) {
            return { started: false, error: 'tUSDT collateral token not deployed yet' };
        }

        this.deploying = true;
        this.updateStatus({
            status: 'deploying_market', step: 1, totalSteps: 6,
            stepLabel: 'Starting deployment...', marketId: params.marketId,
            yesTokenAddress: undefined, yesTokenPubKey: undefined,
            noTokenAddress: undefined, noTokenPubKey: undefined,
            marketAddress: undefined, marketPubKey: undefined,
            lendingPoolAddress: undefined, lendingPoolPubKey: undefined,
            error: undefined, startedAt: Date.now(), elapsedSec: 0,
        });

        this._runDeploy(params).catch((err) => {
            console.error('[DeployService] Deploy failed:', err);
            this.updateStatus({ status: 'failed', error: err.message || 'Deployment failed' });
            this.deploying = false;
        });

        return { started: true };
    }

    private async _runDeploy(params: {
        marketId: number;
        question: string;
        endBlock: number;
        collateralToken: string;
        initialLiquidity: string;
        feeRate: number;
    }): Promise<void> {
        try {
            console.log(`\n[DeployService] ========================================`);
            console.log(`[DeployService] Deploying Market #${params.marketId}: ${params.question}`);
            console.log(`[DeployService] ========================================\n`);

            const tokenWasm = this.getWasmPath('OutcomeToken');
            const marketWasm = this.getWasmPath('PredictionMarket');

            if (!fs.existsSync(tokenWasm)) throw new Error('OutcomeToken.wasm not found');
            if (!fs.existsSync(marketWasm)) throw new Error('PredictionMarket.wasm not found');

            const tokenBytecode = fs.readFileSync(tokenWasm);
            const marketBytecode = fs.readFileSync(marketWasm);

            const initialLiquidity = params.initialLiquidity ? BigInt(params.initialLiquidity) : DEFAULT_INITIAL_LIQUIDITY;
            const feeRate = params.feeRate ? BigInt(params.feeRate) : DEFAULT_FEE_RATE;
            const endBlock = BigInt(params.endBlock);

            // Step 1: Deploy PredictionMarket FIRST (without token addresses)
            this.updateStatus({ step: 1, status: 'deploying_market', stepLabel: 'Deploying PredictionMarket...' });
            console.log('[DeployService] Step 1/6: Deploying PredictionMarket (without token addresses)...');
            console.log(`[DeployService] Using tUSDT as collateral: ${this.collateralTokenAddress}`);

            let utxos = await this.getFreshUtxos('Step 1');

            const marketCalldata = new BinaryWriter();
            marketCalldata.writeAddress(Address.fromString(this.collateralTokenPubKey)); // tUSDT as collateral
            marketCalldata.writeU256(initialLiquidity);
            marketCalldata.writeU256(feeRate);
            marketCalldata.writeU256(endBlock);

            const challenge1 = await this.provider.getChallenge();
            const marketDeploy = await this.factory.signDeployment({
                from: this.account.p2tr, utxos,
                signer: this.account.keypair, mldsaSigner: this.account.mldsaKeypair,
                network, feeRate: 5, priorityFee: 0n, gasSatFee: 10000n,
                bytecode: marketBytecode, calldata: marketCalldata.getBuffer(),
                challenge: challenge1,
                linkMLDSAPublicKeyToAddress: true, revealMLDSAPublicKey: true,
            } as IDeploymentParameters);

            const marketAddress = marketDeploy.contractAddress;
            const marketPubKey = marketDeploy.contractPubKey;
            this.updateStatus({ marketAddress, marketPubKey });
            console.log('[DeployService] Market:', marketAddress);

            await this.provider.sendRawTransaction(marketDeploy.transaction[0], false);
            await this.provider.sendRawTransaction(marketDeploy.transaction[1], false);
            this.updateStatus({ stepLabel: 'Waiting for PredictionMarket confirmation...' });
            await this.waitForContractDeployment(marketAddress, 'Step 1 (Market)');

            // Step 2: Deploy YES OutcomeToken — pass REAL market pubkey so tokens auto-transfer
            this.updateStatus({ step: 2, status: 'deploying_yes_token', stepLabel: 'Deploying YES token...' });
            console.log('[DeployService] Step 2/6: Deploying YES OutcomeToken (market address as recipient)...');

            utxos = await this.getFreshUtxos('Step 2');

            const yesCalldata = new BinaryWriter();
            yesCalldata.writeStringWithLength(`YES-M${params.marketId}`);
            yesCalldata.writeStringWithLength('YES');
            yesCalldata.writeU256(TOKEN_SUPPLY);
            yesCalldata.writeU8(TOKEN_DECIMALS);
            yesCalldata.writeAddress(Address.fromString(marketPubKey)); // REAL market address!

            const challenge2 = await this.provider.getChallenge();
            const yesDeploy = await this.factory.signDeployment({
                from: this.account.p2tr, utxos,
                signer: this.account.keypair, mldsaSigner: this.account.mldsaKeypair,
                network, feeRate: 5, priorityFee: 0n, gasSatFee: 10000n,
                bytecode: tokenBytecode, calldata: yesCalldata.getBuffer(),
                challenge: challenge2,
                linkMLDSAPublicKeyToAddress: true, revealMLDSAPublicKey: true,
            } as IDeploymentParameters);

            const yesAddress = yesDeploy.contractAddress;
            const yesPubKey = yesDeploy.contractPubKey;
            this.updateStatus({ yesTokenAddress: yesAddress, yesTokenPubKey: yesPubKey });
            console.log('[DeployService] YES token:', yesAddress);
            console.log('[DeployService] YES tokens will auto-transfer to market during deployment');

            await this.provider.sendRawTransaction(yesDeploy.transaction[0], false);
            await this.provider.sendRawTransaction(yesDeploy.transaction[1], false);
            this.updateStatus({ stepLabel: 'Waiting for YES token confirmation...' });
            await this.waitForContractDeployment(yesAddress, 'Step 2 (YES)');

            // Step 3: Deploy NO OutcomeToken — pass REAL market pubkey
            this.updateStatus({ step: 3, status: 'deploying_no_token', stepLabel: 'Deploying NO token...' });
            console.log('[DeployService] Step 3/6: Deploying NO OutcomeToken (market address as recipient)...');

            utxos = await this.getFreshUtxos('Step 3');

            const noCalldata = new BinaryWriter();
            noCalldata.writeStringWithLength(`NO-M${params.marketId}`);
            noCalldata.writeStringWithLength('NO');
            noCalldata.writeU256(TOKEN_SUPPLY);
            noCalldata.writeU8(TOKEN_DECIMALS);
            noCalldata.writeAddress(Address.fromString(marketPubKey)); // REAL market address!

            const challenge3 = await this.provider.getChallenge();
            const noDeploy = await this.factory.signDeployment({
                from: this.account.p2tr, utxos,
                signer: this.account.keypair, mldsaSigner: this.account.mldsaKeypair,
                network, feeRate: 5, priorityFee: 0n, gasSatFee: 10000n,
                bytecode: tokenBytecode, calldata: noCalldata.getBuffer(),
                challenge: challenge3,
                linkMLDSAPublicKeyToAddress: true, revealMLDSAPublicKey: true,
            } as IDeploymentParameters);

            const noAddress = noDeploy.contractAddress;
            const noPubKey = noDeploy.contractPubKey;
            this.updateStatus({ noTokenAddress: noAddress, noTokenPubKey: noPubKey });
            console.log('[DeployService] NO token:', noAddress);
            console.log('[DeployService] NO tokens will auto-transfer to market during deployment');

            await this.provider.sendRawTransaction(noDeploy.transaction[0], false);
            await this.provider.sendRawTransaction(noDeploy.transaction[1], false);
            this.updateStatus({ stepLabel: 'Waiting for NO token confirmation...' });
            await this.waitForContractDeployment(noAddress, 'Step 3 (NO)');

            // Step 4: Call setTokenAddresses on PredictionMarket
            this.updateStatus({ step: 4, status: 'setting_tokens', stepLabel: 'Setting token addresses on market...' });
            console.log('[DeployService] Step 4/6: Calling setTokenAddresses on PredictionMarket...');

            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const setTokenUtxos = await this.getFreshUtxos('Step 4 setTokenAddresses');
                    const setTokenCalldata = new BinaryWriter();
                    setTokenCalldata.writeSelector(SET_TOKEN_ADDRESSES_SELECTOR);
                    setTokenCalldata.writeAddress(Address.fromString(yesPubKey));
                    setTokenCalldata.writeAddress(Address.fromString(noPubKey));

                    const challengeSetTokens = await this.provider.getChallenge();
                    const setTokenInteraction = await this.factory.signInteraction({
                        from: this.account.p2tr, to: marketAddress,
                        contract: marketPubKey, utxos: setTokenUtxos,
                        signer: this.account.keypair, mldsaSigner: this.account.mldsaKeypair,
                        network, feeRate: 5, priorityFee: 0n, gasSatFee: 10000n,
                        calldata: setTokenCalldata.getBuffer(), challenge: challengeSetTokens,
                    } as IInteractionParameters);

                    if (setTokenInteraction.fundingTransaction) {
                        await this.provider.sendRawTransaction(setTokenInteraction.fundingTransaction, false);
                    }
                    const setTokenTxId = await this.provider.sendRawTransaction(setTokenInteraction.interactionTransaction, false);
                    const setTokenTxHash = typeof setTokenTxId === 'string' ? setTokenTxId : (setTokenTxId as any)?.result || '';

                    this.updateStatus({ stepLabel: 'Waiting for setTokenAddresses confirmation...' });
                    if (setTokenTxHash) {
                        await this.waitForTxConfirmation(setTokenTxHash, 'Step 4 (setTokenAddresses)');
                    } else {
                        await sleep(POLL_INTERVAL_MS * 4);
                    }
                    console.log('[DeployService] Token addresses set on market contract');
                    break;
                } catch (err: any) {
                    console.log(`[DeployService] setTokenAddresses attempt ${attempt}/3 failed: ${err.message}`);
                    if (attempt === 3) throw new Error('Failed to set token addresses: ' + err.message);
                    await sleep(POLL_INTERVAL_MS);
                }
            }

            // Step 5: Register in MarketFactory
            this.updateStatus({ step: 5, status: 'registering', stepLabel: 'Registering in factory...' });
            console.log('[DeployService] Step 5/6: Registering in MarketFactory...');

            const addrFile = path.resolve(
                path.dirname(fileURLToPath(import.meta.url)),
                '..', '..', '..', 'contracts', 'deployed-addresses.json',
            );
            let factoryPubKey: string | undefined;
            let factoryAddress: string | undefined;
            try {
                const addrs = JSON.parse(fs.readFileSync(addrFile, 'utf-8'));
                factoryAddress = addrs.MarketFactory?.address;
                factoryPubKey = addrs.MarketFactory?.pubKey;
            } catch {}

            let registered = false;
            if (factoryAddress && factoryPubKey) {
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        const currentUtxos = await this.getFreshUtxos('Step 5');
                        const regCalldata = new BinaryWriter();
                        regCalldata.writeSelector(REGISTER_MARKET_SELECTOR);
                        regCalldata.writeAddress(Address.fromString(marketPubKey));

                        const challenge = await this.provider.getChallenge();
                        const interaction = await this.factory.signInteraction({
                            from: this.account.p2tr, to: factoryAddress,
                            contract: factoryPubKey, utxos: currentUtxos,
                            signer: this.account.keypair, mldsaSigner: this.account.mldsaKeypair,
                            network, feeRate: 5, priorityFee: 0n, gasSatFee: 10000n,
                            calldata: regCalldata.getBuffer(), challenge,
                        } as IInteractionParameters);

                        if (interaction.fundingTransaction) {
                            await this.provider.sendRawTransaction(interaction.fundingTransaction, false);
                        }
                        const txId = await this.provider.sendRawTransaction(interaction.interactionTransaction, false);
                        const txHash = typeof txId === 'string' ? txId : (txId as any)?.result || '';

                        this.updateStatus({ stepLabel: 'Waiting for factory registration...' });
                        if (txHash) {
                            await this.waitForTxConfirmation(txHash, 'Step 5 (register)');
                        } else {
                            await sleep(POLL_INTERVAL_MS * 4);
                        }
                        registered = true;
                        break;
                    } catch (err: any) {
                        console.log(`[DeployService] Register attempt ${attempt}/3 failed: ${err.message}`);
                        await sleep(POLL_INTERVAL_MS);
                    }
                }
            } else {
                console.log('[DeployService] No factory address, skipping registration');
                registered = true;
            }

            // Step 6: Deploy LendingPool
            this.updateStatus({ step: 6, status: 'deploying_lending_pool', stepLabel: 'Deploying LendingPool...' });
            console.log('[DeployService] Step 6/6: Deploying LendingPool...');

            const lendingWasm = this.getWasmPath('LendingPool');
            let lendingPoolAddress = '';
            let lendingPoolPubKey = '';

            if (fs.existsSync(lendingWasm)) {
                const lendingBytecode = fs.readFileSync(lendingWasm);
                utxos = await this.getFreshUtxos('Step 6');

                const lendingCalldata = new BinaryWriter();
                lendingCalldata.writeAddress(Address.fromString(marketPubKey));   // marketAddress
                lendingCalldata.writeAddress(Address.fromString(yesPubKey));      // yesToken
                lendingCalldata.writeAddress(Address.fromString(noPubKey));       // noToken
                lendingCalldata.writeAddress(Address.fromString(this.collateralTokenPubKey));  // tUSDT (borç verilen token)
                lendingCalldata.writeU256(5000n);  // LTV 50% (bps)
                lendingCalldata.writeU256(500n);   // Interest 5% (bps)

                const challenge6 = await this.provider.getChallenge();
                const lendingDeploy = await this.factory.signDeployment({
                    from: this.account.p2tr, utxos,
                    signer: this.account.keypair, mldsaSigner: this.account.mldsaKeypair,
                    network, feeRate: 5, priorityFee: 0n, gasSatFee: 10000n,
                    bytecode: lendingBytecode, calldata: lendingCalldata.getBuffer(),
                    challenge: challenge6,
                    linkMLDSAPublicKeyToAddress: true, revealMLDSAPublicKey: true,
                } as IDeploymentParameters);

                lendingPoolAddress = lendingDeploy.contractAddress;
                lendingPoolPubKey = lendingDeploy.contractPubKey;
                this.updateStatus({ lendingPoolAddress, lendingPoolPubKey });
                console.log('[DeployService] LendingPool:', lendingPoolAddress);

                await this.provider.sendRawTransaction(lendingDeploy.transaction[0], false);
                await this.provider.sendRawTransaction(lendingDeploy.transaction[1], false);
                this.updateStatus({ stepLabel: 'Waiting for LendingPool confirmation...' });
                await this.waitForContractDeployment(lendingPoolAddress, 'Step 6 (LendingPool)');

                // Step 6b: adminMint ile doğrudan LendingPool'a 50K tUSDT mint et
                if (this.collateralTokenAddress && this.collateralTokenPubKey && lendingPoolPubKey) {
                    console.log('[DeployService] Step 6b: adminMint 50K tUSDT to LendingPool...');
                    this.updateStatus({ stepLabel: 'Funding LendingPool with 50K tUSDT...' });
                    try {
                        const mintUtxos = await this.getFreshUtxos('Step 6b adminMint');
                        const mintCalldata = new BinaryWriter();
                        mintCalldata.writeSelector(ADMIN_MINT_SELECTOR);
                        mintCalldata.writeAddress(Address.fromString(lendingPoolPubKey));
                        mintCalldata.writeU256(LENDING_POOL_FUND_AMOUNT);

                        const challengeMint = await this.provider.getChallenge();
                        const mintTx = await this.factory.signInteraction({
                            from: this.account.p2tr, to: this.collateralTokenAddress,
                            contract: this.collateralTokenPubKey, utxos: mintUtxos,
                            signer: this.account.keypair, mldsaSigner: this.account.mldsaKeypair,
                            network, feeRate: 5, priorityFee: 0n, gasSatFee: 10000n,
                            calldata: mintCalldata.getBuffer(), challenge: challengeMint,
                        } as IInteractionParameters);

                        if (mintTx.fundingTransaction) {
                            await this.provider.sendRawTransaction(mintTx.fundingTransaction, false);
                        }
                        const mintTxRaw = await this.provider.sendRawTransaction(mintTx.interactionTransaction, false);
                        const mintTxHash = typeof mintTxRaw === 'string' ? mintTxRaw : (mintTxRaw as any)?.result || '';
                        console.log('[DeployService] adminMint TX sent:', mintTxHash, 'raw:', JSON.stringify(mintTxRaw));

                        if (mintTxHash) {
                            await this.waitForTxConfirmation(mintTxHash, 'Step 6b (adminMint)');
                            console.log('[DeployService] LendingPool funded with 50K tUSDT (CONFIRMED)');
                        } else {
                            await sleep(POLL_INTERVAL_MS * 4);
                            console.log('[DeployService] adminMint sent (no hash, waited)');
                        }
                    } catch (fundErr: any) {
                        console.error('[DeployService] FAILED to fund LendingPool:', fundErr.message);
                    }
                }
            } else {
                console.log('[DeployService] LendingPool.wasm not found, skipping');
            }

            console.log(`\n[DeployService] ========================================`);
            console.log(`[DeployService] COMPLETE - Market #${params.marketId}`);
            console.log(`[DeployService] MKT: ${marketAddress}`);
            console.log(`[DeployService] YES: ${yesAddress}`);
            console.log(`[DeployService] NO:  ${noAddress}`);
            console.log(`[DeployService] tUSDT: ${this.collateralTokenAddress}`);
            console.log(`[DeployService] REG: ${registered}`);
            console.log(`[DeployService] LENDING: ${lendingPoolAddress || 'skipped'}`);
            console.log(`[DeployService] ========================================\n`);

            this.updateStatus({
                status: 'complete',
                stepLabel: 'Deployment complete!',
            });
            this.deploying = false;
        } catch (err: any) {
            console.error('[DeployService] Deployment failed:', err);
            this.updateStatus({ status: 'failed', error: err.message || 'Deployment failed' });
            this.deploying = false;
        }
    }
}

export const deployService = new DeployService();
