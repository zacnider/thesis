import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const OracleResolverEvents = [];

export const OracleResolverAbi = [
    {
        name: 'proposeResolution',
        inputs: [
            { name: 'marketAddress', type: ABIDataTypes.ADDRESS },
            { name: 'outcome', type: ABIDataTypes.UINT256 },
            { name: 'bondAmount', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'disputeResolution',
        inputs: [
            { name: 'marketAddress', type: ABIDataTypes.ADDRESS },
            { name: 'newOutcome', type: ABIDataTypes.UINT256 },
            { name: 'disputeBond', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'finalizeResolution',
        inputs: [{ name: 'marketAddress', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'outcome', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'emergencyResolve',
        inputs: [
            { name: 'marketAddress', type: ABIDataTypes.ADDRESS },
            { name: 'outcome', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getProposal',
        inputs: [{ name: 'marketAddress', type: ABIDataTypes.ADDRESS }],
        outputs: [
            { name: 'state', type: ABIDataTypes.UINT256 },
            { name: 'outcome', type: ABIDataTypes.UINT256 },
            { name: 'bond', type: ABIDataTypes.UINT256 },
            { name: 'proposalBlock', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getMinimumBond',
        inputs: [],
        outputs: [{ name: 'minimumBond', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'setMinimumBond',
        inputs: [{ name: 'newMinBond', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    ...OracleResolverEvents,
    ...OP_NET_ABI,
];

export default OracleResolverAbi;
