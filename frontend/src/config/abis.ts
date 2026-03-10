import { ABIDataTypes, BitcoinAbiTypes, type BitcoinInterfaceAbi, OP_NET_ABI } from 'opnet';

// PredictionMarket ABI
export const PREDICTION_MARKET_ABI: BitcoinInterfaceAbi = [
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
    ...OP_NET_ABI,
];

// LendingPool ABI
export const LENDING_POOL_ABI: BitcoinInterfaceAbi = [
    {
        name: 'depositCollateral',
        inputs: [
            { name: 'isYes', type: ABIDataTypes.BOOL },
            { name: 'amount', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'withdrawCollateral',
        inputs: [
            { name: 'isYes', type: ABIDataTypes.BOOL },
            { name: 'amount', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'borrow',
        inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'repay',
        inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'setPrice',
        inputs: [
            { name: 'yesPrice', type: ABIDataTypes.UINT256 },
            { name: 'noPrice', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'settleAfterResolution',
        inputs: [{ name: 'outcome', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getPositionInfo',
        inputs: [{ name: 'user', type: ABIDataTypes.ADDRESS }],
        outputs: [
            { name: 'yesCollateral', type: ABIDataTypes.UINT256 },
            { name: 'noCollateral', type: ABIDataTypes.UINT256 },
            { name: 'borrowed', type: ABIDataTypes.UINT256 },
            { name: 'maxBorrow', type: ABIDataTypes.UINT256 },
            { name: 'interestOwed', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getPoolInfo',
        inputs: [],
        outputs: [
            { name: 'totalYesCollateral', type: ABIDataTypes.UINT256 },
            { name: 'totalNoCollateral', type: ABIDataTypes.UINT256 },
            { name: 'totalBorrowed', type: ABIDataTypes.UINT256 },
            { name: 'loanCount', type: ABIDataTypes.UINT256 },
            { name: 'ltvNumerator', type: ABIDataTypes.UINT256 },
            { name: 'interestRate', type: ABIDataTypes.UINT256 },
            { name: 'resolved', type: ABIDataTypes.BOOL },
            { name: 'winningOutcome', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Function,
    },
    ...OP_NET_ABI,
];

// OP20 token ABI (for outcome tokens)
export const OP20_ABI: BitcoinInterfaceAbi = [
    {
        name: 'balanceOf',
        inputs: [{ name: 'address', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'balance', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'allowance',
        inputs: [
            { name: 'owner', type: ABIDataTypes.ADDRESS },
            { name: 'spender', type: ABIDataTypes.ADDRESS },
        ],
        outputs: [{ name: 'remaining', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'increaseAllowance',
        inputs: [
            { name: 'spender', type: ABIDataTypes.ADDRESS },
            { name: 'amount', type: ABIDataTypes.UINT256 },
        ],
        outputs: [],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'decreaseAllowance',
        inputs: [
            { name: 'spender', type: ABIDataTypes.ADDRESS },
            { name: 'amount', type: ABIDataTypes.UINT256 },
        ],
        outputs: [],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'transfer',
        inputs: [
            { name: 'to', type: ABIDataTypes.ADDRESS },
            { name: 'amount', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'faucet',
        inputs: [],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    ...OP_NET_ABI,
];
