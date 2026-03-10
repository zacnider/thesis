import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const PredictionMarketEvents = [];

export const PredictionMarketAbi = [
    {
        name: 'setTokenAddresses',
        inputs: [
            { name: 'yesToken', type: ABIDataTypes.ADDRESS },
            { name: 'noToken', type: ABIDataTypes.ADDRESS },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'buyOutcome',
        inputs: [
            { name: 'isYes', type: ABIDataTypes.BOOL },
            { name: 'collateralAmount', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'tokensOut', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'sellOutcome',
        inputs: [
            { name: 'isYes', type: ABIDataTypes.BOOL },
            { name: 'tokenAmount', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'collateralOut', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'resolve',
        inputs: [{ name: 'outcome', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'redeem',
        inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'payout', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getPrice',
        inputs: [],
        outputs: [
            { name: 'yesPrice', type: ABIDataTypes.UINT256 },
            { name: 'noPrice', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getMarketInfo',
        inputs: [],
        outputs: [
            { name: 'yesReserve', type: ABIDataTypes.UINT256 },
            { name: 'noReserve', type: ABIDataTypes.UINT256 },
            { name: 'totalCollateral', type: ABIDataTypes.UINT256 },
            { name: 'totalTrades', type: ABIDataTypes.UINT256 },
            { name: 'totalVolume', type: ABIDataTypes.UINT256 },
            { name: 'feeRate', type: ABIDataTypes.UINT256 },
            { name: 'endBlock', type: ABIDataTypes.UINT256 },
            { name: 'resolved', type: ABIDataTypes.BOOL },
            { name: 'winningOutcome', type: ABIDataTypes.UINT256 },
            { name: 'accumulatedFees', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getQuote',
        inputs: [
            { name: 'isYes', type: ABIDataTypes.BOOL },
            { name: 'collateralAmount', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'tokensOut', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'setFeeRate',
        inputs: [{ name: 'feeRate', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'withdrawFees',
        inputs: [],
        outputs: [{ name: 'fees', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    ...PredictionMarketEvents,
    ...OP_NET_ABI,
];

export default PredictionMarketAbi;
