import { JSONRpcProvider } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import 'dotenv/config';

const network = (networks as any).opnetTestnet;

class ChainService {
    private provider!: JSONRpcProvider;

    init(): void {
        const rpcUrl = process.env.RPC_URL || 'https://testnet.opnet.org';
        this.provider = new JSONRpcProvider({ url: rpcUrl, network });
        console.log('[ChainService] Connected to', rpcUrl);
    }

    getProvider(): JSONRpcProvider {
        return this.provider;
    }

    async getBlockNumber(): Promise<number> {
        try {
            const block = await this.provider.getBlockNumber();
            return Number(block);
        } catch (err) {
            console.error('[ChainService] getBlockNumber error:', err);
            return 0;
        }
    }

    async getContractCode(address: string): Promise<boolean> {
        try {
            const code = await this.provider.getCode(address);
            return code !== null && code !== undefined;
        } catch {
            return false;
        }
    }
}

export const chainService = new ChainService();
