import { useState, useCallback, useRef, useEffect } from 'react';
import { getContract } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import { Address } from '@btc-vision/transaction';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { useProvider } from '../context/ProviderContext';
import { LENDING_POOL_ABI, OP20_ABI } from '../config/abis';

const opnetTestnet = (networks as Record<string, typeof networks.testnet>).opnetTestnet;
const MAX_SAT = 1_000_000n;
const PRECISION = 10n ** 18n;

export interface LendingPosition {
    yesCollateral: bigint;
    noCollateral: bigint;
    borrowed: bigint;
    maxBorrow: bigint;
    interestOwed: bigint;
}

export interface PoolInfo {
    totalYesCollateral: bigint;
    totalNoCollateral: bigint;
    totalBorrowed: bigint;
    loanCount: bigint;
    ltvNumerator: bigint;
    interestRate: bigint;
    resolved: boolean;
    winningOutcome: bigint;
}

export interface LendingStep {
    label: string;
    status: 'pending' | 'active' | 'done' | 'error';
}

export interface LendingStatus {
    active: boolean;
    type: 'deposit' | 'withdraw' | 'borrow' | 'repay' | null;
    steps: LendingStep[];
    currentStep: number;
    error?: string;
    success?: boolean;
}

const INITIAL_STATUS: LendingStatus = { active: false, type: null, steps: [], currentStep: 0 };

const DEPOSIT_STEPS = [
    'Simulating approval...',
    'Sending approval to wallet...',
    'Waiting for approval confirmation...',
    'Simulating deposit...',
    'Sending deposit to wallet...',
    'Confirming on-chain...',
    'Deposit confirmed!',
];

const BORROW_STEPS = [
    'Simulating borrow...',
    'Sending to wallet...',
    'Confirming on-chain...',
    'Borrow confirmed!',
];

const REPAY_STEPS = [
    'Simulating repay...',
    'Sending to wallet...',
    'Confirming on-chain...',
    'Repay confirmed!',
];

const WITHDRAW_STEPS = [
    'Simulating withdrawal...',
    'Sending to wallet...',
    'Confirming on-chain...',
    'Withdrawal confirmed!',
];

export function useLendingPool(
    lendingPoolAddress: string | undefined,
    yesTokenAddress?: string,
    noTokenAddress?: string,
) {
    const provider = useProvider();
    const { walletAddress, address, network } = useWalletConnect();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lendingStatus, setLendingStatus] = useState<LendingStatus>(INITIAL_STATUS);
    const [position, setPosition] = useState<LendingPosition | null>(null);
    const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);

    const net = network || opnetTestnet;

    const makeSteps = (labels: string[]): LendingStep[] =>
        labels.map((label) => ({ label, status: 'pending' as const }));

    const advanceStep = (stepLabels: string[], stepIndex: number) => {
        setLendingStatus((prev) => ({
            ...prev,
            currentStep: stepIndex,
            steps: stepLabels.map((label, i) => ({
                label,
                status: i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending',
            })),
        }));
    };

    const finishAction = (stepLabels: string[], success: boolean, errorMsg?: string) => {
        setLendingStatus((prev) => ({
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

    const resetStatus = () => setLendingStatus(INITIAL_STATUS);

    const getLendingContract = useCallback(() => {
        if (!lendingPoolAddress) return null;
        return getContract(
            lendingPoolAddress,
            LENDING_POOL_ABI as any,
            provider,
            net,
            (address as any) || undefined,
        );
    }, [lendingPoolAddress, provider, address, net]);

    const getTokenContract = useCallback((tokenAddr: string) => {
        return getContract(
            tokenAddr,
            OP20_ABI as any,
            provider,
            net,
            (address as any) || undefined,
        );
    }, [provider, address, net]);

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
    // Read: Position info
    // ========================================
    const fetchPosition = useCallback(async (): Promise<LendingPosition | null> => {
        try {
            const contract = getLendingContract() as any;
            if (!contract || !address) return null;
            const result = await contract.getPositionInfo(address);
            if (result.revert) return null;
            const p = result.properties;
            const pos: LendingPosition = {
                yesCollateral: p.yesCollateral as bigint,
                noCollateral: p.noCollateral as bigint,
                borrowed: p.borrowed as bigint,
                maxBorrow: p.maxBorrow as bigint,
                interestOwed: p.interestOwed as bigint,
            };
            setPosition(pos);
            return pos;
        } catch (err) {
            console.error('[fetchPosition]', err);
            return null;
        }
    }, [getLendingContract, address]);

    // ========================================
    // Read: Pool info
    // ========================================
    const fetchPoolInfo = useCallback(async (): Promise<PoolInfo | null> => {
        try {
            const contract = getLendingContract() as any;
            if (!contract) return null;
            const result = await contract.getPoolInfo();
            if (result.revert) return null;
            const p = result.properties;
            const info: PoolInfo = {
                totalYesCollateral: p.totalYesCollateral as bigint,
                totalNoCollateral: p.totalNoCollateral as bigint,
                totalBorrowed: p.totalBorrowed as bigint,
                loanCount: p.loanCount as bigint,
                ltvNumerator: p.ltvNumerator as bigint,
                interestRate: p.interestRate as bigint,
                resolved: p.resolved as boolean,
                winningOutcome: p.winningOutcome as bigint,
            };
            setPoolInfo(info);
            return info;
        } catch (err) {
            console.error('[fetchPoolInfo]', err);
            return null;
        }
    }, [getLendingContract]);

    const fetchPositionRef = useRef(fetchPosition);
    fetchPositionRef.current = fetchPosition;

    // Poll until position state changes on-chain
    const pollForPositionChange = async (prevPosition: LendingPosition | null): Promise<boolean> => {
        const MAX_ATTEMPTS = 80;
        const prev = prevPosition || { yesCollateral: 0n, noCollateral: 0n, borrowed: 0n, maxBorrow: 0n, interestOwed: 0n };
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            await new Promise(r => setTimeout(r, 15000));
            try {
                const current = await fetchPositionRef.current();
                if (!current) continue;
                console.log(`[lending poll] #${attempt + 1}: prev borrowed=${prev.borrowed}, current=${current.borrowed}, prev yesColl=${prev.yesCollateral}, current=${current.yesCollateral}`);
                if (
                    current.yesCollateral !== prev.yesCollateral ||
                    current.noCollateral !== prev.noCollateral ||
                    current.borrowed !== prev.borrowed ||
                    current.interestOwed !== prev.interestOwed
                ) {
                    return true;
                }
            } catch (err) {
                console.warn('[lending poll] error:', err);
            }
        }
        throw new Error('Transaction confirmation timed out');
    };

    // Auto-poll
    useEffect(() => {
        if (!lendingPoolAddress) return;
        fetchPoolInfo();
        fetchPosition();
        const interval = setInterval(() => {
            fetchPoolInfo();
            fetchPosition();
        }, 30000);
        return () => clearInterval(interval);
    }, [lendingPoolAddress, fetchPoolInfo, fetchPosition]);

    // ========================================
    // Deposit collateral
    // ========================================
    const depositCollateral = useCallback(async (isYes: boolean, amount: bigint) => {
        const tokenAddr = isYes ? yesTokenAddress : noTokenAddress;
        if (!walletAddress || !lendingPoolAddress || !tokenAddr) {
            setError('Wallet not connected or lending pool not ready');
            return null;
        }
        setLoading(true);
        setError(null);
        setLendingStatus({ active: true, type: 'deposit', steps: makeSteps(DEPOSIT_STEPS), currentStep: 0 });
        try {
            // Approve token
            advanceStep(DEPOSIT_STEPS, 0);
            const tokenContract = getTokenContract(tokenAddr) as any;
            const poolAddr = await resolveAddress(lendingPoolAddress);
            if (!poolAddr) throw new Error('Could not resolve lending pool address');

            const prevAllowance = await getAllowance(tokenAddr, poolAddr);
            const approveSim = await tokenContract.increaseAllowance(poolAddr, amount);
            if (approveSim.revert) throw new Error('Approve failed: ' + approveSim.revert);

            advanceStep(DEPOSIT_STEPS, 1);
            await sendTx(approveSim);

            advanceStep(DEPOSIT_STEPS, 2);
            await pollForApproval(tokenAddr, poolAddr, prevAllowance);

            // Deposit
            advanceStep(DEPOSIT_STEPS, 3);
            const lendingContract = getLendingContract() as any;
            if (!lendingContract) throw new Error('Lending contract not available');
            const prevPos = position ? { ...position } : null;
            const depositSim = await lendingContract.depositCollateral(isYes, amount);
            if (depositSim.revert) throw new Error('Deposit failed: ' + depositSim.revert);

            advanceStep(DEPOSIT_STEPS, 4);
            const result = await sendTx(depositSim);

            advanceStep(DEPOSIT_STEPS, 5);
            await pollForPositionChange(prevPos);

            advanceStep(DEPOSIT_STEPS, 6);
            finishAction(DEPOSIT_STEPS, true);
            await fetchPoolInfo();
            return result;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Deposit failed';
            setError(msg);
            finishAction(DEPOSIT_STEPS, false, msg);
            return null;
        } finally {
            setLoading(false);
        }
    }, [walletAddress, lendingPoolAddress, yesTokenAddress, noTokenAddress, getLendingContract, getTokenContract, net, position, fetchPosition, fetchPoolInfo]);

    // ========================================
    // Borrow
    // ========================================
    const borrow = useCallback(async (amount: bigint) => {
        if (!walletAddress || !lendingPoolAddress) {
            setError('Wallet not connected');
            return null;
        }
        setLoading(true);
        setError(null);
        setLendingStatus({ active: true, type: 'borrow', steps: makeSteps(BORROW_STEPS), currentStep: 0 });
        try {
            advanceStep(BORROW_STEPS, 0);
            const lendingContract = getLendingContract() as any;
            if (!lendingContract) throw new Error('Lending contract not available');
            const prevPos = position ? { ...position } : null;
            const sim = await lendingContract.borrow(amount);
            if (sim.revert) throw new Error('Borrow failed: ' + sim.revert);

            advanceStep(BORROW_STEPS, 1);
            const result = await sendTx(sim);

            advanceStep(BORROW_STEPS, 2);
            await pollForPositionChange(prevPos);

            advanceStep(BORROW_STEPS, 3);
            finishAction(BORROW_STEPS, true);
            await fetchPoolInfo();
            return result;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Borrow failed';
            setError(msg);
            finishAction(BORROW_STEPS, false, msg);
            return null;
        } finally {
            setLoading(false);
        }
    }, [walletAddress, lendingPoolAddress, getLendingContract, net, position, fetchPoolInfo]);

    // ========================================
    // Repay
    // ========================================
    const repay = useCallback(async (amount: bigint) => {
        if (!walletAddress || !lendingPoolAddress) {
            setError('Wallet not connected');
            return null;
        }
        setLoading(true);
        setError(null);
        setLendingStatus({ active: true, type: 'repay', steps: makeSteps(REPAY_STEPS), currentStep: 0 });
        try {
            advanceStep(REPAY_STEPS, 0);
            const lendingContract = getLendingContract() as any;
            if (!lendingContract) throw new Error('Lending contract not available');
            const prevPos = position ? { ...position } : null;
            const sim = await lendingContract.repay(amount);
            if (sim.revert) throw new Error('Repay failed: ' + sim.revert);

            advanceStep(REPAY_STEPS, 1);
            const result = await sendTx(sim);

            advanceStep(REPAY_STEPS, 2);
            await pollForPositionChange(prevPos);

            advanceStep(REPAY_STEPS, 3);
            finishAction(REPAY_STEPS, true);
            await fetchPoolInfo();
            return result;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Repay failed';
            setError(msg);
            finishAction(REPAY_STEPS, false, msg);
            return null;
        } finally {
            setLoading(false);
        }
    }, [walletAddress, lendingPoolAddress, getLendingContract, net, position, fetchPoolInfo]);

    // ========================================
    // Withdraw collateral
    // ========================================
    const withdrawCollateral = useCallback(async (isYes: boolean, amount: bigint) => {
        if (!walletAddress || !lendingPoolAddress) {
            setError('Wallet not connected');
            return null;
        }
        setLoading(true);
        setError(null);
        setLendingStatus({ active: true, type: 'withdraw', steps: makeSteps(WITHDRAW_STEPS), currentStep: 0 });
        try {
            advanceStep(WITHDRAW_STEPS, 0);
            const lendingContract = getLendingContract() as any;
            if (!lendingContract) throw new Error('Lending contract not available');
            const prevPos = position ? { ...position } : null;
            const sim = await lendingContract.withdrawCollateral(isYes, amount);
            if (sim.revert) throw new Error('Withdraw failed: ' + sim.revert);

            advanceStep(WITHDRAW_STEPS, 1);
            const result = await sendTx(sim);

            advanceStep(WITHDRAW_STEPS, 2);
            await pollForPositionChange(prevPos);

            advanceStep(WITHDRAW_STEPS, 3);
            finishAction(WITHDRAW_STEPS, true);
            await fetchPoolInfo();
            return result;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Withdraw failed';
            setError(msg);
            finishAction(WITHDRAW_STEPS, false, msg);
            return null;
        } finally {
            setLoading(false);
        }
    }, [walletAddress, lendingPoolAddress, getLendingContract, net, position, fetchPoolInfo]);

    return {
        loading,
        error,
        setError,
        lendingStatus,
        resetStatus,
        position,
        poolInfo,
        fetchPosition,
        fetchPoolInfo,
        depositCollateral,
        borrow,
        repay,
        withdrawCollateral,
    };
}
