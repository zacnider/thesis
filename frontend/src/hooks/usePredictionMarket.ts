import { useState, useCallback, useRef, useEffect } from 'react';
import { getContract } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import { Address } from '@btc-vision/transaction';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { useProvider } from '../context/ProviderContext';
import { PREDICTION_MARKET_ABI, OP20_ABI } from '../config/abis';

const opnetTestnet = (networks as Record<string, typeof networks.testnet>).opnetTestnet;
const MAX_SAT = 1_000_000n;

export interface TradeStep {
    label: string;
    status: 'pending' | 'active' | 'done' | 'error';
}

export interface TradeStatus {
    active: boolean;
    type: 'buy' | 'sell' | 'redeem' | null;
    steps: TradeStep[];
    currentStep: number;
    error?: string;
    success?: boolean;
}

export interface MarketInfo {
    yesReserve: bigint;
    noReserve: bigint;
    totalCollateral: bigint;
    totalTrades: bigint;
    totalVolume: bigint;
    feeRate: bigint;
    endBlock: bigint;
    resolved: boolean;
    winningOutcome: bigint;
    accumulatedFees: bigint;
}

export interface PriceInfo {
    yesPrice: number;
    noPrice: number;
}

const INITIAL_STATUS: TradeStatus = { active: false, type: null, steps: [], currentStep: 0 };

const BUY_STEPS = [
    'Simulating approval...',
    'Sending approval to wallet...',
    'Waiting for approval confirmation...',
    'Simulating buy transaction...',
    'Sending buy to wallet...',
    'Confirming on-chain...',
    'Trade confirmed!',
];

const SELL_STEPS = [
    'Simulating token approval...',
    'Sending approval to wallet...',
    'Waiting for approval confirmation...',
    'Simulating sell transaction...',
    'Sending sell to wallet...',
    'Confirming on-chain...',
    'Trade confirmed!',
];

const REDEEM_STEPS = [
    'Simulating redeem...',
    'Sending to wallet...',
    'Confirming on-chain...',
    'Redeemed!',
];

/**
 * Hook for interacting with a PredictionMarket contract on OP_NET.
 * Handles buy/sell outcome tokens, redeem winnings, and price reading.
 */
export function usePredictionMarket(
    marketAddress: string | undefined,
    yesTokenAddress?: string,
    noTokenAddress?: string,
    collateralTokenAddress?: string,
) {
    const provider = useProvider();
    const { walletAddress, address, network } = useWalletConnect();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tradeStatus, setTradeStatus] = useState<TradeStatus>(INITIAL_STATUS);
    const [marketInfo, setMarketInfo] = useState<MarketInfo | null>(null);
    const [priceInfo, setPriceInfo] = useState<PriceInfo>({ yesPrice: 0.5, noPrice: 0.5 });

    const net = network || opnetTestnet;

    const makeSteps = (labels: string[]): TradeStep[] =>
        labels.map((label) => ({ label, status: 'pending' as const }));

    const advanceStep = (stepLabels: string[], stepIndex: number) => {
        setTradeStatus((prev) => ({
            ...prev,
            currentStep: stepIndex,
            steps: stepLabels.map((label, i) => ({
                label,
                status: i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending',
            })),
        }));
    };

    const finishTrade = (stepLabels: string[], success: boolean, errorMsg?: string) => {
        setTradeStatus((prev) => ({
            ...prev,
            currentStep: stepLabels.length - 1,
            success,
            error: errorMsg,
            steps: stepLabels.map((label, i) => ({
                label,
                status: success
                    ? 'done'
                    : i < prev.currentStep ? 'done' : i === prev.currentStep ? 'error' : 'pending',
            })),
        }));
    };

    const resetTradeStatus = () => setTradeStatus(INITIAL_STATUS);

    const getMarketContract = useCallback(() => {
        if (!marketAddress) return null;
        return getContract(
            marketAddress,
            PREDICTION_MARKET_ABI as any,
            provider,
            net,
            (address as any) || undefined,
        );
    }, [marketAddress, provider, address, net]);

    const getTokenContract = useCallback((tokenAddr: string) => {
        return getContract(
            tokenAddr,
            OP20_ABI as any,
            provider,
            net,
            (address as any) || undefined,
        );
    }, [provider, address, net]);

    // Resolve bech32 to Address object
    const resolveAddress = async (bech32: string): Promise<Address | null> => {
        try {
            const raw = await (provider as any).getPublicKeysInfoRaw(bech32);
            if (raw) {
                const info = raw[bech32] || Object.values(raw)[0];
                const key = (info as any)?.tweakedPubkey || (info as any)?.mldsaHashedPublicKey || (info as any)?.originalPubKey;
                if (key && !(info as any)?.error) return Address.fromString(key);
            }
        } catch { /* ignore */ }
        try {
            const addr = await provider.getPublicKeyInfo(bech32, false);
            if (addr) return addr;
        } catch { /* ignore */ }
        return null;
    };

    const sendTx = async (sim: any, satToSpend: bigint = MAX_SAT) => {
        return sim.sendTransaction({
            signer: null,
            mldsaSigner: null,
            refundTo: walletAddress ?? '',
            maximumAllowedSatToSpend: satToSpend,
            network: net,
        });
    };

    // Get token balance
    const getTokenBalance = useCallback(async (tokenAddr: string): Promise<bigint> => {
        if (!address || !tokenAddr) return 0n;
        try {
            const contract = getTokenContract(tokenAddr) as any;
            const result = await contract.balanceOf(address);
            if (result.revert) return 0n;
            return result.properties.balance as bigint;
        } catch {
            return 0n;
        }
    }, [address, getTokenContract]);

    const getTokenBalanceRef = useRef(getTokenBalance);
    getTokenBalanceRef.current = getTokenBalance;

    // Poll until token balance changes
    const pollForBalanceChange = async (tokenAddr: string, prevBalance: bigint): Promise<boolean> => {
        const MAX_ATTEMPTS = 80;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            await new Promise(r => setTimeout(r, 15000));
            try {
                const current = await getTokenBalanceRef.current(tokenAddr);
                console.log(`[poll] balance #${attempt + 1}: prev=${prevBalance}, current=${current}`);
                if (current !== prevBalance) return true;
            } catch (err) {
                console.warn(`[poll] error:`, err);
            }
        }
        throw new Error('Transaction confirmation timed out');
    };

    // Get allowance
    const getAllowance = async (tokenAddr: string, spender: Address): Promise<bigint> => {
        try {
            const contract = getTokenContract(tokenAddr) as any;
            if (!address) return 0n;
            const result = await contract.allowance(address, spender);
            if (result.revert) return 0n;
            return result.properties.remaining as bigint;
        } catch {
            return 0n;
        }
    };

    const getAllowanceRef = useRef(getAllowance);
    getAllowanceRef.current = getAllowance;

    // Poll for allowance confirmation
    const pollForApproval = async (tokenAddr: string, spender: Address, prevAllowance: bigint): Promise<boolean> => {
        const MAX_ATTEMPTS = 80;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            await new Promise(r => setTimeout(r, 15000));
            try {
                const current = await getAllowanceRef.current(tokenAddr, spender);
                if (current > prevAllowance) return true;
            } catch { /* ignore */ }
        }
        throw new Error('Approval confirmation timed out');
    };

    // ========================================
    // Read: Get market info from chain
    // ========================================
    const fetchMarketInfo = useCallback(async (): Promise<MarketInfo | null> => {
        try {
            const contract = getMarketContract() as any;
            if (!contract) return null;
            const result = await contract.getMarketInfo();
            if (result.revert) return null;
            const p = result.properties;
            const info: MarketInfo = {
                yesReserve: p.yesReserve as bigint,
                noReserve: p.noReserve as bigint,
                totalCollateral: p.totalCollateral as bigint,
                totalTrades: p.totalTrades as bigint,
                totalVolume: p.totalVolume as bigint,
                feeRate: p.feeRate as bigint,
                endBlock: p.endBlock as bigint,
                resolved: p.resolved as boolean,
                winningOutcome: p.winningOutcome as bigint,
                accumulatedFees: p.accumulatedFees as bigint,
            };
            setMarketInfo(info);

            // Calculate prices from reserves
            const yesRes = Number(info.yesReserve);
            const noRes = Number(info.noReserve);
            const total = yesRes + noRes;
            if (total > 0) {
                setPriceInfo({
                    yesPrice: noRes / total,  // YES price = NO_reserve / (YES_reserve + NO_reserve)
                    noPrice: yesRes / total,
                });
            }
            return info;
        } catch {
            return null;
        }
    }, [getMarketContract]);

    // ========================================
    // Read: Get price
    // ========================================
    const fetchPrice = useCallback(async (): Promise<PriceInfo | null> => {
        try {
            const contract = getMarketContract() as any;
            if (!contract) return null;
            const result = await contract.getPrice();
            if (result.revert) return null;
            const yesP = Number(result.properties.yesPrice as bigint);
            const noP = Number(result.properties.noPrice as bigint);
            const PRECISION = 1e18;
            const info = {
                yesPrice: yesP / PRECISION,
                noPrice: noP / PRECISION,
            };
            setPriceInfo(info);
            return info;
        } catch {
            return null;
        }
    }, [getMarketContract]);

    // ========================================
    // Read: Get quote
    // ========================================
    const getQuote = useCallback(async (isYes: boolean, collateralAmount: bigint): Promise<bigint | null> => {
        try {
            const contract = getMarketContract() as any;
            if (!contract) return null;
            const result = await contract.getQuote(isYes, collateralAmount);
            if (result.revert) return null;
            return result.properties.tokensOut as bigint;
        } catch {
            return null;
        }
    }, [getMarketContract]);

    // Try to fetch price once on mount, silently ignore errors
    useEffect(() => {
        if (!marketAddress) return;
        fetchPrice().catch(() => {});
    }, [marketAddress, fetchPrice]);

    // ========================================
    // Buy outcome tokens
    // ========================================
    const buyOutcome = useCallback(async (isYes: boolean, collateralAmount: bigint) => {
        if (!walletAddress || !collateralTokenAddress || !marketAddress) {
            setError('Wallet not connected or market not ready');
            return null;
        }
        console.log('[BUY] Starting buy:', { isYes, collateralAmount: collateralAmount.toString(), marketAddress, collateralTokenAddress });
        setLoading(true);
        setError(null);
        setTradeStatus({ active: true, type: 'buy', steps: makeSteps(BUY_STEPS), currentStep: 0 });
        try {
            // Step 0: Approve collateral spending
            advanceStep(BUY_STEPS, 0);
            const tokenContract = getTokenContract(collateralTokenAddress) as any;
            if (!tokenContract) throw new Error('Collateral token contract not available');

            const marketAddr = await resolveAddress(marketAddress);
            console.log('[BUY] Resolved market address:', marketAddr ? 'OK' : 'FAILED');
            if (!marketAddr) throw new Error('Could not resolve market address');

            const prevAllowance = await getAllowance(collateralTokenAddress, marketAddr);
            console.log('[BUY] Previous allowance:', prevAllowance.toString());
            const approveSim = await tokenContract.increaseAllowance(marketAddr, collateralAmount);
            console.log('[BUY] Approve sim:', approveSim?.revert || 'OK');
            if (approveSim.revert) throw new Error('Approve failed: ' + approveSim.revert);

            // Step 1: Send approval
            advanceStep(BUY_STEPS, 1);
            await sendTx(approveSim);
            console.log('[BUY] Approve tx sent to wallet');

            // Step 2: Wait for approval
            advanceStep(BUY_STEPS, 2);
            await pollForApproval(collateralTokenAddress, marketAddr, prevAllowance);
            console.log('[BUY] Approval confirmed');

            // Step 3: Simulate buy
            advanceStep(BUY_STEPS, 3);
            const marketContract = getMarketContract() as any;
            if (!marketContract) throw new Error('Market contract not available');

            // Check user's collateral balance before buy
            const userBalance = await getTokenBalance(collateralTokenAddress);
            console.log('[BUY] User collateral balance:', userBalance.toString(), '(' + (Number(userBalance) / 1e18).toFixed(4) + ' tokens)');
            console.log('[BUY] Amount to spend:', collateralAmount.toString(), '(' + (Number(collateralAmount) / 1e18).toFixed(4) + ' tokens)');
            console.log('[BUY] Balance sufficient?', userBalance >= collateralAmount);

            // Check market contract's outcome token balance
            const outToken = isYes ? yesTokenAddress : noTokenAddress;
            if (outToken) {
                try {
                    const outContract = getTokenContract(outToken) as any;
                    const marketAddrObj = await resolveAddress(marketAddress);
                    if (marketAddrObj) {
                        const mktBal = await outContract.balanceOf(marketAddrObj);
                        console.log('[BUY] Market YES/NO token balance:', mktBal?.revert || (mktBal?.properties?.balance?.toString() || '0'), '(' + (Number(mktBal?.properties?.balance || 0n) / 1e18).toFixed(4) + ' tokens)');
                    }
                } catch (e) { console.log('[BUY] Could not check market token balance:', e); }
            }

            // Check allowance
            const currentAllowance = await getAllowance(collateralTokenAddress, marketAddr);
            console.log('[BUY] Current allowance for market:', currentAllowance.toString(), '(' + (Number(currentAllowance) / 1e18).toFixed(4) + ' tokens)');

            console.log('[BUY] Simulating buyOutcome...');
            const buySim = await marketContract.buyOutcome(isYes, collateralAmount);
            console.log('[BUY] Buy sim result:', buySim?.revert || 'OK', buySim?.properties);
            if (buySim.revert) throw new Error('Buy failed: ' + buySim.revert);

            // Step 4: Send buy tx
            advanceStep(BUY_STEPS, 4);
            const outTokenAddr = isYes ? yesTokenAddress : noTokenAddress;
            const balBefore = outTokenAddr ? await getTokenBalance(outTokenAddr) : 0n;
            const result = await sendTx(buySim);
            console.log('[BUY] Buy tx sent to wallet');

            // Step 5: Confirming
            advanceStep(BUY_STEPS, 5);
            if (outTokenAddr) {
                await pollForBalanceChange(outTokenAddr, balBefore);
            }

            // Step 6: Done
            advanceStep(BUY_STEPS, 6);
            finishTrade(BUY_STEPS, true);
            console.log('[BUY] Trade completed successfully');
            return result;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Buy failed';
            console.error('[BUY] Trade failed:', msg, err);
            setError(msg);
            finishTrade(BUY_STEPS, false, msg);
            return null;
        } finally {
            setLoading(false);
        }
    }, [walletAddress, marketAddress, collateralTokenAddress, yesTokenAddress, noTokenAddress, getMarketContract, getTokenContract, net, fetchPrice]);

    // ========================================
    // Sell outcome tokens
    // ========================================
    const sellOutcome = useCallback(async (isYes: boolean, tokenAmount: bigint) => {
        if (!walletAddress || !marketAddress) {
            setError('Wallet not connected');
            return null;
        }
        const outTokenAddr = isYes ? yesTokenAddress : noTokenAddress;
        if (!outTokenAddr) {
            setError('Token address not available');
            return null;
        }
        console.log('[SELL] Starting sell:', { isYes, tokenAmount: tokenAmount.toString(), marketAddress, outTokenAddr });
        setLoading(true);
        setError(null);
        setTradeStatus({ active: true, type: 'sell', steps: makeSteps(SELL_STEPS), currentStep: 0 });
        try {
            // Step 0: Approve token spending
            advanceStep(SELL_STEPS, 0);
            const tokenContract = getTokenContract(outTokenAddr) as any;

            const marketAddr = await resolveAddress(marketAddress);
            console.log('[SELL] Resolved market address:', marketAddr ? 'OK' : 'FAILED');
            if (!marketAddr) throw new Error('Could not resolve market address');

            const prevAllowance = await getAllowance(outTokenAddr, marketAddr);
            const approveSim = await tokenContract.increaseAllowance(marketAddr, tokenAmount);
            console.log('[SELL] Approve sim:', approveSim?.revert || 'OK');
            if (approveSim.revert) throw new Error('Approve failed: ' + approveSim.revert);

            // Step 1: Send approval
            advanceStep(SELL_STEPS, 1);
            await sendTx(approveSim);
            console.log('[SELL] Approve tx sent');

            // Step 2: Wait
            advanceStep(SELL_STEPS, 2);
            await pollForApproval(outTokenAddr, marketAddr, prevAllowance);
            console.log('[SELL] Approval confirmed');

            // Step 3: Simulate sell
            advanceStep(SELL_STEPS, 3);
            const marketContract = getMarketContract() as any;
            if (!marketContract) throw new Error('Market contract not available');

            console.log('[SELL] Simulating sellOutcome...');
            const sellSim = await marketContract.sellOutcome(isYes, tokenAmount);
            console.log('[SELL] Sell sim result:', sellSim?.revert || 'OK', sellSim?.properties);
            if (sellSim.revert) throw new Error('Sell failed: ' + sellSim.revert);

            // Step 4: Send
            advanceStep(SELL_STEPS, 4);
            const balBefore = await getTokenBalance(outTokenAddr);
            const result = await sendTx(sellSim);
            console.log('[SELL] Sell tx sent');

            // Step 5: Confirming
            advanceStep(SELL_STEPS, 5);
            await pollForBalanceChange(outTokenAddr, balBefore);

            // Step 6: Done
            advanceStep(SELL_STEPS, 6);
            finishTrade(SELL_STEPS, true);
            console.log('[SELL] Trade completed successfully');
            return result;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Sell failed';
            console.error('[SELL] Trade failed:', msg, err);
            setError(msg);
            finishTrade(SELL_STEPS, false, msg);
            return null;
        } finally {
            setLoading(false);
        }
    }, [walletAddress, marketAddress, yesTokenAddress, noTokenAddress, getMarketContract, getTokenContract, net, fetchPrice]);

    // ========================================
    // Redeem winnings
    // ========================================
    const redeem = useCallback(async (amount: bigint) => {
        if (!walletAddress || !marketAddress) {
            setError('Wallet not connected');
            return null;
        }
        setLoading(true);
        setError(null);
        setTradeStatus({ active: true, type: 'redeem', steps: makeSteps(REDEEM_STEPS), currentStep: 0 });
        try {
            advanceStep(REDEEM_STEPS, 0);
            const marketContract = getMarketContract() as any;
            if (!marketContract) throw new Error('Market contract not available');

            const sim = await marketContract.redeem(amount);
            if (sim.revert) throw new Error('Redeem failed: ' + sim.revert);

            advanceStep(REDEEM_STEPS, 1);
            const result = await sendTx(sim);

            advanceStep(REDEEM_STEPS, 2);
            await new Promise(r => setTimeout(r, 15000));

            advanceStep(REDEEM_STEPS, 3);
            finishTrade(REDEEM_STEPS, true);
            return result;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Redeem failed';
            setError(msg);
            finishTrade(REDEEM_STEPS, false, msg);
            return null;
        } finally {
            setLoading(false);
        }
    }, [walletAddress, marketAddress, getMarketContract, net]);

    return {
        loading,
        error,
        setError,
        tradeStatus,
        resetTradeStatus,
        marketInfo,
        priceInfo,
        fetchMarketInfo,
        fetchPrice,
        getQuote,
        getTokenBalance,
        buyOutcome,
        sellOutcome,
        redeem,
    };
}
