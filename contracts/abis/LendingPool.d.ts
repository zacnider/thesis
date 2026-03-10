import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the depositCollateral function call.
 */
export type DepositCollateral = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the withdrawCollateral function call.
 */
export type WithdrawCollateral = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the borrow function call.
 */
export type Borrow = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the repay function call.
 */
export type Repay = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the setPrice function call.
 */
export type SetPrice = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the settleAfterResolution function call.
 */
export type SettleAfterResolution = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getPositionInfo function call.
 */
export type GetPositionInfo = CallResult<
    {
        yesCollateral: bigint;
        noCollateral: bigint;
        borrowed: bigint;
        maxBorrow: bigint;
        interestOwed: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getPoolInfo function call.
 */
export type GetPoolInfo = CallResult<
    {
        totalYesCollateral: bigint;
        totalNoCollateral: bigint;
        totalBorrowed: bigint;
        loanCount: bigint;
        ltvNumerator: bigint;
        interestRate: bigint;
        resolved: boolean;
        winningOutcome: bigint;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// ILendingPool
// ------------------------------------------------------------------
export interface ILendingPool extends IOP_NETContract {
    depositCollateral(isYes: boolean, amount: bigint): Promise<DepositCollateral>;
    withdrawCollateral(isYes: boolean, amount: bigint): Promise<WithdrawCollateral>;
    borrow(amount: bigint): Promise<Borrow>;
    repay(amount: bigint): Promise<Repay>;
    setPrice(yesPrice: bigint, noPrice: bigint): Promise<SetPrice>;
    settleAfterResolution(outcome: bigint): Promise<SettleAfterResolution>;
    getPositionInfo(user: Address): Promise<GetPositionInfo>;
    getPoolInfo(): Promise<GetPoolInfo>;
}
