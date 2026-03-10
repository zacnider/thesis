import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the proposeResolution function call.
 */
export type ProposeResolution = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the disputeResolution function call.
 */
export type DisputeResolution = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the finalizeResolution function call.
 */
export type FinalizeResolution = CallResult<
    {
        outcome: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the emergencyResolve function call.
 */
export type EmergencyResolve = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getProposal function call.
 */
export type GetProposal = CallResult<
    {
        state: bigint;
        outcome: bigint;
        bond: bigint;
        proposalBlock: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getMinimumBond function call.
 */
export type GetMinimumBond = CallResult<
    {
        minimumBond: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the setMinimumBond function call.
 */
export type SetMinimumBond = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IOracleResolver
// ------------------------------------------------------------------
export interface IOracleResolver extends IOP_NETContract {
    proposeResolution(marketAddress: Address, outcome: bigint, bondAmount: bigint): Promise<ProposeResolution>;
    disputeResolution(marketAddress: Address, newOutcome: bigint, disputeBond: bigint): Promise<DisputeResolution>;
    finalizeResolution(marketAddress: Address): Promise<FinalizeResolution>;
    emergencyResolve(marketAddress: Address, outcome: bigint): Promise<EmergencyResolve>;
    getProposal(marketAddress: Address): Promise<GetProposal>;
    getMinimumBond(): Promise<GetMinimumBond>;
    setMinimumBond(newMinBond: bigint): Promise<SetMinimumBond>;
}
