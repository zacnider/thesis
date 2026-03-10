import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the recordPrediction function call.
 */
export type RecordPrediction = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the recordResolution function call.
 */
export type RecordResolution = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getUserStats function call.
 */
export type GetUserStats = CallResult<
    {
        totalPredictions: bigint;
        correctPredictions: bigint;
        winStreak: bigint;
        bestStreak: bigint;
        totalProfit: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getTotalUsers function call.
 */
export type GetTotalUsers = CallResult<
    {
        totalUsers: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getAccuracy function call.
 */
export type GetAccuracy = CallResult<
    {
        accuracy: bigint;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IReputationTracker
// ------------------------------------------------------------------
export interface IReputationTracker extends IOP_NETContract {
    recordPrediction(user: Address, marketAddress: Address): Promise<RecordPrediction>;
    recordResolution(user: Address, isCorrect: boolean, profitAmount: bigint): Promise<RecordResolution>;
    getUserStats(user: Address): Promise<GetUserStats>;
    getTotalUsers(): Promise<GetTotalUsers>;
    getAccuracy(user: Address): Promise<GetAccuracy>;
}
