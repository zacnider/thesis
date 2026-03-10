import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the setTokenAddresses function call.
 */
export type SetTokenAddresses = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the buyOutcome function call.
 */
export type BuyOutcome = CallResult<
    {
        tokensOut: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the sellOutcome function call.
 */
export type SellOutcome = CallResult<
    {
        collateralOut: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the resolve function call.
 */
export type Resolve = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the redeem function call.
 */
export type Redeem = CallResult<
    {
        payout: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getPrice function call.
 */
export type GetPrice = CallResult<
    {
        yesPrice: bigint;
        noPrice: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getMarketInfo function call.
 */
export type GetMarketInfo = CallResult<
    {
        yesReserve: bigint;
        noReserve: bigint;
        totalCollateral: bigint;
        totalTrades: bigint;
        totalVolume: bigint;
        feeRate: bigint;
        endBlock: bigint;
        resolved: boolean;
        winningOutcome: bigint;
        accumulatedFees: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getQuote function call.
 */
export type GetQuote = CallResult<
    {
        tokensOut: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the setFeeRate function call.
 */
export type SetFeeRate = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the withdrawFees function call.
 */
export type WithdrawFees = CallResult<
    {
        fees: bigint;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IPredictionMarket
// ------------------------------------------------------------------
export interface IPredictionMarket extends IOP_NETContract {
    setTokenAddresses(yesToken: Address, noToken: Address): Promise<SetTokenAddresses>;
    buyOutcome(isYes: boolean, collateralAmount: bigint): Promise<BuyOutcome>;
    sellOutcome(isYes: boolean, tokenAmount: bigint): Promise<SellOutcome>;
    resolve(outcome: bigint): Promise<Resolve>;
    redeem(amount: bigint): Promise<Redeem>;
    getPrice(): Promise<GetPrice>;
    getMarketInfo(): Promise<GetMarketInfo>;
    getQuote(isYes: boolean, collateralAmount: bigint): Promise<GetQuote>;
    setFeeRate(feeRate: bigint): Promise<SetFeeRate>;
    withdrawFees(): Promise<WithdrawFees>;
}
