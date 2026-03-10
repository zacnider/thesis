import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const ReputationTrackerEvents = [];

export const ReputationTrackerAbi = [
    {
        name: 'recordPrediction',
        inputs: [
            { name: 'user', type: ABIDataTypes.ADDRESS },
            { name: 'marketAddress', type: ABIDataTypes.ADDRESS },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'recordResolution',
        inputs: [
            { name: 'user', type: ABIDataTypes.ADDRESS },
            { name: 'isCorrect', type: ABIDataTypes.BOOL },
            { name: 'profitAmount', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getUserStats',
        inputs: [{ name: 'user', type: ABIDataTypes.ADDRESS }],
        outputs: [
            { name: 'totalPredictions', type: ABIDataTypes.UINT256 },
            { name: 'correctPredictions', type: ABIDataTypes.UINT256 },
            { name: 'winStreak', type: ABIDataTypes.UINT256 },
            { name: 'bestStreak', type: ABIDataTypes.UINT256 },
            { name: 'totalProfit', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getTotalUsers',
        inputs: [],
        outputs: [{ name: 'totalUsers', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getAccuracy',
        inputs: [{ name: 'user', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'accuracy', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    ...ReputationTrackerEvents,
    ...OP_NET_ABI,
];

export default ReputationTrackerAbi;
