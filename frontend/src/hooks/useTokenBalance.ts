import { useState, useEffect, useCallback } from 'react';
import { getContract } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import { useProvider } from '../context/ProviderContext';
import { OP20_ABI } from '../config/abis';

const opnetTestnet = (networks as Record<string, typeof networks.testnet>).opnetTestnet;

interface TokenBalanceResult {
    balance: bigint;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export function useTokenBalance(
    tokenAddress: string | undefined,
    userAddress: any,
    network?: typeof networks.testnet,
): TokenBalanceResult {
    const provider = useProvider();
    const net = network || opnetTestnet;
    const [balance, setBalance] = useState<bigint>(0n);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBalance = useCallback(async () => {
        if (!tokenAddress || !userAddress || !provider) {
            setBalance(0n);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const contract = getContract(tokenAddress, OP20_ABI as any, provider, net) as any;
            const result = await contract.balanceOf(userAddress);
            if (result?.revert) {
                setError(result.revert);
                return;
            }
            const bal = result?.properties?.balance;
            if (bal !== undefined && bal !== null) {
                setBalance(BigInt(bal.toString()));
            }
        } catch (err: any) {
            setError(err?.message || String(err));
        } finally {
            setLoading(false);
        }
    }, [tokenAddress, userAddress, provider, net]);

    useEffect(() => {
        fetchBalance();
        const iv = setInterval(fetchBalance, 30000);
        return () => clearInterval(iv);
    }, [fetchBalance]);

    return { balance, loading, error, refetch: fetchBalance };
}

export function useMultiTokenBalances(
    tokens: Array<{ address: string; label: string }>,
    userAddress: any,
    network?: typeof networks.testnet,
): Record<string, { balance: bigint; loading: boolean }> {
    const provider = useProvider();
    const net = network || opnetTestnet;
    const [balances, setBalances] = useState<Record<string, { balance: bigint; loading: boolean }>>({});

    const fetchAll = useCallback(async () => {
        if (!userAddress || !provider || tokens.length === 0) return;

        const results: Record<string, { balance: bigint; loading: boolean }> = {};
        for (const token of tokens) {
            if (!token.address) {
                results[token.label] = { balance: 0n, loading: false };
                continue;
            }
            results[token.label] = { balance: 0n, loading: true };
        }
        setBalances({ ...results });

        for (const token of tokens) {
            if (!token.address) continue;
            try {
                const contract = getContract(token.address, OP20_ABI as any, provider, net) as any;
                const result = await contract.balanceOf(userAddress);
                const bal = result?.properties?.balance;
                if (bal !== undefined && bal !== null) {
                    results[token.label] = { balance: BigInt(bal.toString()), loading: false };
                } else {
                    results[token.label] = { balance: 0n, loading: false };
                }
            } catch {
                results[token.label] = { balance: 0n, loading: false };
            }
        }
        setBalances({ ...results });
    }, [tokens.map(t => t.address).join(','), userAddress, provider, net]);

    useEffect(() => {
        fetchAll();
        const iv = setInterval(fetchAll, 30000);
        return () => clearInterval(iv);
    }, [fetchAll]);

    return balances;
}
