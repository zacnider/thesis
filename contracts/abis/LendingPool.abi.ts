import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const LendingPoolEvents = [];

export const LendingPoolAbi = [
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
    ...LendingPoolEvents,
    ...OP_NET_ABI,
];

export default LendingPoolAbi;
