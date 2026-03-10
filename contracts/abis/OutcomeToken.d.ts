import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the getMarketAddress function call.
 */
export type GetMarketAddress = CallResult<
    {
        marketAddress: Address;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IOutcomeToken
// ------------------------------------------------------------------
export interface IOutcomeToken extends IOP_NETContract {
    getMarketAddress(): Promise<GetMarketAddress>;
}
