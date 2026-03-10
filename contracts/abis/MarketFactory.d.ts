import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the registerMarket function call.
 */
export type RegisterMarket = CallResult<
    {
        marketId: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the markResolved function call.
 */
export type MarkResolved = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getMarketCount function call.
 */
export type GetMarketCount = CallResult<
    {
        count: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getMarket function call.
 */
export type GetMarket = CallResult<
    {
        marketAddress: Address;
        isActive: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getOwner function call.
 */
export type GetOwner = CallResult<
    {
        owner: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the transferOwnership function call.
 */
export type TransferOwnership = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IMarketFactory
// ------------------------------------------------------------------
export interface IMarketFactory extends IOP_NETContract {
    registerMarket(marketAddress: Address): Promise<RegisterMarket>;
    markResolved(marketId: bigint, outcome: bigint): Promise<MarkResolved>;
    getMarketCount(): Promise<GetMarketCount>;
    getMarket(marketId: bigint): Promise<GetMarket>;
    getOwner(): Promise<GetOwner>;
    transferOwnership(newOwner: Address): Promise<TransferOwnership>;
}
