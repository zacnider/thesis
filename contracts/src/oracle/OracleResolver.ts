import {
    Blockchain,
    BytesWriter,
    Calldata,
    OP_NET,
    Address,
    Revert,
    StoredAddress,
    StoredBoolean,
    StoredU256,
    SafeMath,
    TransferHelper,
    encodePointerUnknownLength,
    EMPTY_POINTER,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

// Proposal states: 0 = none, 1 = proposed, 2 = disputed, 3 = finalized
const STATE_NONE: u256 = u256.Zero;
const STATE_PROPOSED: u256 = u256.One;
const STATE_DISPUTED: u256 = u256.fromU64(2);
const STATE_FINALIZED: u256 = u256.fromU64(3);

const CHALLENGE_PERIOD: u256 = u256.fromU64(100); // 100 blocks

@final
export class OracleResolver extends OP_NET {
    // Storage pointers
    private readonly ownerPointer: u16 = Blockchain.nextPointer;
    private readonly collateralTokenPointer: u16 = Blockchain.nextPointer;
    private readonly minimumBondPointer: u16 = Blockchain.nextPointer;
    private readonly proposalCountPointer: u16 = Blockchain.nextPointer;

    // Per-proposal storage (keyed by marketAddress)
    private readonly proposalStateBasePointer: u16 = Blockchain.nextPointer;
    private readonly proposalOutcomeBasePointer: u16 = Blockchain.nextPointer;
    private readonly proposalBondBasePointer: u16 = Blockchain.nextPointer;
    private readonly proposalProposerBasePointer: u16 = Blockchain.nextPointer;
    private readonly proposalBlockBasePointer: u16 = Blockchain.nextPointer;
    private readonly proposalDisputerBasePointer: u16 = Blockchain.nextPointer;
    private readonly proposalDisputeBondBasePointer: u16 = Blockchain.nextPointer;

    // Storage fields
    private owner: StoredAddress = new StoredAddress(this.ownerPointer);
    private collateralToken: StoredAddress = new StoredAddress(this.collateralTokenPointer);
    private minimumBond: StoredU256 = new StoredU256(this.minimumBondPointer, EMPTY_POINTER);
    private proposalCount: StoredU256 = new StoredU256(this.proposalCountPointer, EMPTY_POINTER);

    constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        const collateralAddr: Address = calldata.readAddress();
        const minBond: u256 = calldata.readU256();

        this.owner.value = Blockchain.tx.sender;
        this.collateralToken.value = collateralAddr;
        this.minimumBond.value = minBond;
        this.proposalCount.value = u256.Zero;
    }

    // ========================================
    // Proposal Methods
    // ========================================

    @method(
        { name: 'marketAddress', type: ABIDataTypes.ADDRESS },
        { name: 'outcome', type: ABIDataTypes.UINT256 },
        { name: 'bondAmount', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public proposeResolution(calldata: Calldata): BytesWriter {
        const marketAddress: Address = calldata.readAddress();
        const outcome: u256 = calldata.readU256();
        const bondAmount: u256 = calldata.readU256();

        // Validate
        if (outcome != u256.One && outcome != u256.fromU64(2)) {
            throw new Revert('Invalid outcome: must be 1 or 2');
        }
        if (bondAmount < this.minimumBond.value) {
            throw new Revert('Bond below minimum');
        }

        // Check no existing proposal
        const currentState = this.getProposalState(marketAddress);
        if (currentState != STATE_NONE) {
            throw new Revert('Proposal already exists');
        }

        const sender = Blockchain.tx.sender;

        // Take bond from proposer
        TransferHelper.transferFrom(
            this.collateralToken.value,
            sender,
            Blockchain.contractAddress,
            bondAmount,
        );

        // Store proposal
        this.setProposalState(marketAddress, STATE_PROPOSED);
        this.setProposalOutcome(marketAddress, outcome);
        this.setProposalBond(marketAddress, bondAmount);
        this.setProposalProposer(marketAddress, sender);
        this.setProposalBlock(marketAddress, Blockchain.block.numberU256);

        this.proposalCount.value = SafeMath.add(this.proposalCount.value, u256.One);

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    @method(
        { name: 'marketAddress', type: ABIDataTypes.ADDRESS },
        { name: 'newOutcome', type: ABIDataTypes.UINT256 },
        { name: 'disputeBond', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public disputeResolution(calldata: Calldata): BytesWriter {
        const marketAddress: Address = calldata.readAddress();
        const newOutcome: u256 = calldata.readU256();
        const disputeBond: u256 = calldata.readU256();

        // Validate
        if (newOutcome != u256.One && newOutcome != u256.fromU64(2)) {
            throw new Revert('Invalid outcome');
        }

        const currentState = this.getProposalState(marketAddress);
        if (currentState != STATE_PROPOSED) {
            throw new Revert('No active proposal to dispute');
        }

        // Check still in challenge period
        const proposedBlock = this.getProposalBlock(marketAddress);
        const deadline = SafeMath.add(proposedBlock, CHALLENGE_PERIOD);
        if (Blockchain.block.numberU256 > deadline) {
            throw new Revert('Challenge period expired');
        }

        // Dispute bond must be 2x original
        const originalBond = this.getProposalBond(marketAddress);
        const requiredBond = SafeMath.mul(originalBond, u256.fromU64(2));
        if (disputeBond < requiredBond) {
            throw new Revert('Dispute bond must be 2x original');
        }

        const sender = Blockchain.tx.sender;

        // Take dispute bond
        TransferHelper.transferFrom(
            this.collateralToken.value,
            sender,
            Blockchain.contractAddress,
            disputeBond,
        );

        // Update proposal to disputed state
        this.setProposalState(marketAddress, STATE_DISPUTED);
        this.setProposalOutcome(marketAddress, newOutcome);
        this.setProposalDisputer(marketAddress, sender);
        this.setProposalDisputeBond(marketAddress, disputeBond);
        // Reset challenge period
        this.setProposalBlock(marketAddress, Blockchain.block.numberU256);

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    @method({ name: 'marketAddress', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'outcome', type: ABIDataTypes.UINT256 })
    public finalizeResolution(calldata: Calldata): BytesWriter {
        const marketAddress: Address = calldata.readAddress();

        const currentState = this.getProposalState(marketAddress);
        if (currentState != STATE_PROPOSED && currentState != STATE_DISPUTED) {
            throw new Revert('No proposal to finalize');
        }

        // Check challenge period has passed
        const proposedBlock = this.getProposalBlock(marketAddress);
        const deadline = SafeMath.add(proposedBlock, CHALLENGE_PERIOD);
        if (Blockchain.block.numberU256 <= deadline) {
            throw new Revert('Challenge period not over');
        }

        const outcome = this.getProposalOutcome(marketAddress);
        const bond = this.getProposalBond(marketAddress);

        // If disputed, the winner gets both bonds
        if (currentState == STATE_DISPUTED) {
            const disputeBond = this.getProposalDisputeBond(marketAddress);
            const disputer = this.getProposalDisputer(marketAddress);
            // Disputer won — gets original bond + their bond back
            const totalPayout = SafeMath.add(bond, disputeBond);
            TransferHelper.transfer(this.collateralToken.value, disputer, totalPayout);
        } else {
            // No dispute — return bond to proposer
            const proposer = this.getProposalProposer(marketAddress);
            TransferHelper.transfer(this.collateralToken.value, proposer, bond);
        }

        // Mark as finalized
        this.setProposalState(marketAddress, STATE_FINALIZED);

        const writer = new BytesWriter(32);
        writer.writeU256(outcome);
        return writer;
    }

    @method(
        { name: 'marketAddress', type: ABIDataTypes.ADDRESS },
        { name: 'outcome', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public emergencyResolve(calldata: Calldata): BytesWriter {
        const sender = Blockchain.tx.sender;
        if (sender !== this.owner.value) {
            throw new Revert('Only owner');
        }

        const marketAddress: Address = calldata.readAddress();
        const outcome: u256 = calldata.readU256();

        if (outcome != u256.One && outcome != u256.fromU64(2)) {
            throw new Revert('Invalid outcome');
        }

        // Refund any existing bonds
        const currentState = this.getProposalState(marketAddress);
        if (currentState == STATE_PROPOSED) {
            const bond = this.getProposalBond(marketAddress);
            const proposer = this.getProposalProposer(marketAddress);
            TransferHelper.transfer(this.collateralToken.value, proposer, bond);
        } else if (currentState == STATE_DISPUTED) {
            const bond = this.getProposalBond(marketAddress);
            const proposer = this.getProposalProposer(marketAddress);
            TransferHelper.transfer(this.collateralToken.value, proposer, bond);
            const disputeBond = this.getProposalDisputeBond(marketAddress);
            const disputer = this.getProposalDisputer(marketAddress);
            TransferHelper.transfer(this.collateralToken.value, disputer, disputeBond);
        }

        // Set final outcome
        this.setProposalState(marketAddress, STATE_FINALIZED);
        this.setProposalOutcome(marketAddress, outcome);

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ========================================
    // View Methods
    // ========================================

    @method({ name: 'marketAddress', type: ABIDataTypes.ADDRESS })
    @returns(
        { name: 'state', type: ABIDataTypes.UINT256 },
        { name: 'outcome', type: ABIDataTypes.UINT256 },
        { name: 'bond', type: ABIDataTypes.UINT256 },
        { name: 'proposalBlock', type: ABIDataTypes.UINT256 },
    )
    public getProposal(calldata: Calldata): BytesWriter {
        const marketAddress: Address = calldata.readAddress();

        const writer = new BytesWriter(128);
        writer.writeU256(this.getProposalState(marketAddress));
        writer.writeU256(this.getProposalOutcome(marketAddress));
        writer.writeU256(this.getProposalBond(marketAddress));
        writer.writeU256(this.getProposalBlock(marketAddress));
        return writer;
    }

    @method()
    @returns({ name: 'minimumBond', type: ABIDataTypes.UINT256 })
    public getMinimumBond(calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(32);
        writer.writeU256(this.minimumBond.value);
        return writer;
    }

    @method({ name: 'newMinBond', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public setMinimumBond(calldata: Calldata): BytesWriter {
        const sender = Blockchain.tx.sender;
        if (sender !== this.owner.value) {
            throw new Revert('Only owner');
        }

        const newMin: u256 = calldata.readU256();
        this.minimumBond.value = newMin;

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ========================================
    // Internal Storage Helpers (per-market keyed)
    // ========================================

    private _marketKey(basePointer: u16, market: Address): Uint8Array {
        const keyWriter = new BytesWriter(32);
        keyWriter.writeAddress(market);
        return encodePointerUnknownLength(basePointer, keyWriter.getBuffer());
    }

    private getProposalState(market: Address): u256 {
        const key = this._marketKey(this.proposalStateBasePointer, market);
        return u256.fromUint8ArrayBE(Blockchain.getStorageAt(key));
    }

    private setProposalState(market: Address, state: u256): void {
        const key = this._marketKey(this.proposalStateBasePointer, market);
        Blockchain.setStorageAt(key, state.toUint8Array(true));
    }

    private getProposalOutcome(market: Address): u256 {
        const key = this._marketKey(this.proposalOutcomeBasePointer, market);
        return u256.fromUint8ArrayBE(Blockchain.getStorageAt(key));
    }

    private setProposalOutcome(market: Address, outcome: u256): void {
        const key = this._marketKey(this.proposalOutcomeBasePointer, market);
        Blockchain.setStorageAt(key, outcome.toUint8Array(true));
    }

    private getProposalBond(market: Address): u256 {
        const key = this._marketKey(this.proposalBondBasePointer, market);
        return u256.fromUint8ArrayBE(Blockchain.getStorageAt(key));
    }

    private setProposalBond(market: Address, bond: u256): void {
        const key = this._marketKey(this.proposalBondBasePointer, market);
        Blockchain.setStorageAt(key, bond.toUint8Array(true));
    }

    private getProposalProposer(market: Address): Address {
        const key = this._marketKey(this.proposalProposerBasePointer, market);
        return changetype<Address>(Blockchain.getStorageAt(key));
    }

    private setProposalProposer(market: Address, proposer: Address): void {
        const key = this._marketKey(this.proposalProposerBasePointer, market);
        Blockchain.setStorageAt(key, proposer);
    }

    private getProposalBlock(market: Address): u256 {
        const key = this._marketKey(this.proposalBlockBasePointer, market);
        return u256.fromUint8ArrayBE(Blockchain.getStorageAt(key));
    }

    private setProposalBlock(market: Address, block: u256): void {
        const key = this._marketKey(this.proposalBlockBasePointer, market);
        Blockchain.setStorageAt(key, block.toUint8Array(true));
    }

    private getProposalDisputer(market: Address): Address {
        const key = this._marketKey(this.proposalDisputerBasePointer, market);
        return changetype<Address>(Blockchain.getStorageAt(key));
    }

    private setProposalDisputer(market: Address, disputer: Address): void {
        const key = this._marketKey(this.proposalDisputerBasePointer, market);
        Blockchain.setStorageAt(key, disputer);
    }

    private getProposalDisputeBond(market: Address): u256 {
        const key = this._marketKey(this.proposalDisputeBondBasePointer, market);
        return u256.fromUint8ArrayBE(Blockchain.getStorageAt(key));
    }

    private setProposalDisputeBond(market: Address, bond: u256): void {
        const key = this._marketKey(this.proposalDisputeBondBasePointer, market);
        Blockchain.setStorageAt(key, bond.toUint8Array(true));
    }
}
