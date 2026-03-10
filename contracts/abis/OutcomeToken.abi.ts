import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const OutcomeTokenEvents = [];

export const OutcomeTokenAbi = [
    {
        name: 'getMarketAddress',
        inputs: [],
        outputs: [{ name: 'marketAddress', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    ...OutcomeTokenEvents,
    ...OP_NET_ABI,
];

export default OutcomeTokenAbi;
