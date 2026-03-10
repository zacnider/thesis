import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const FaucetTokenEvents = [];

export const FaucetTokenAbi = [
    {
        name: 'faucet',
        inputs: [],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    ...FaucetTokenEvents,
    ...OP_NET_ABI,
];

export default FaucetTokenAbi;
