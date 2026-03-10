import {
    Blockchain,
    BytesWriter,
    Calldata,
    OP_NET,
    Address,
    Revert,
    StoredAddress,
    StoredU256,
    SafeMath,
    encodePointerUnknownLength,
    EMPTY_POINTER,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

@final
export class MarketFactory extends OP_NET {
    // Storage pointers
    private readonly ownerPointer: u16 = Blockchain.nextPointer;
    private readonly marketCountPointer: u16 = Blockchain.nextPointer;
    private readonly marketAddressesBasePointer: u16 = Blockchain.nextPointer;
    private readonly marketActiveBasePointer: u16 = Blockchain.nextPointer;

    // Storage fields
    private owner: StoredAddress = new StoredAddress(this.ownerPointer);
    private marketCount: StoredU256 = new StoredU256(this.marketCountPointer, EMPTY_POINTER);

    constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        this.owner.value = Blockchain.tx.sender;
        this.marketCount.value = u256.Zero;
    }

    // ========================================
    // Registry Methods
    // ========================================

    @method({ name: 'marketAddress', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'marketId', type: ABIDataTypes.UINT256 })
    public registerMarket(calldata: Calldata): BytesWriter {
        const sender = Blockchain.tx.sender;
        if (sender !== this.owner.value) {
            throw new Revert('Only owner can register markets');
        }

        const marketAddress: Address = calldata.readAddress();

        // Get next market ID
        const marketId = this.marketCount.value;
        const newCount = SafeMath.add(marketId, u256.One);
        this.marketCount.value = newCount;

        // Store market address by ID
        this.setMarketAddress(marketId, marketAddress);

        // Mark as active
        this.setMarketActive(marketId, true);

        const writer = new BytesWriter(32);
        writer.writeU256(marketId);
        return writer;
    }

    @method(
        { name: 'marketId', type: ABIDataTypes.UINT256 },
        { name: 'outcome', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public markResolved(calldata: Calldata): BytesWriter {
        const sender = Blockchain.tx.sender;
        if (sender !== this.owner.value) {
            throw new Revert('Only owner');
        }

        const marketId: u256 = calldata.readU256();
        const _outcome: u256 = calldata.readU256();

        // Validate market exists
        if (marketId >= this.marketCount.value) {
            throw new Revert('Market does not exist');
        }

        // Mark as inactive (resolved)
        this.setMarketActive(marketId, false);

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ========================================
    // View Methods
    // ========================================

    @method()
    @returns({ name: 'count', type: ABIDataTypes.UINT256 })
    public getMarketCount(calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(32);
        writer.writeU256(this.marketCount.value);
        return writer;
    }

    @method({ name: 'marketId', type: ABIDataTypes.UINT256 })
    @returns(
        { name: 'marketAddress', type: ABIDataTypes.ADDRESS },
        { name: 'isActive', type: ABIDataTypes.BOOL },
    )
    public getMarket(calldata: Calldata): BytesWriter {
        const marketId: u256 = calldata.readU256();

        if (marketId >= this.marketCount.value) {
            throw new Revert('Market does not exist');
        }

        const addr = this.getMarketAddress(marketId);
        const active = this.getMarketActive(marketId);

        const writer = new BytesWriter(33);
        writer.writeAddress(addr);
        writer.writeBoolean(active);
        return writer;
    }

    @method()
    @returns({ name: 'owner', type: ABIDataTypes.ADDRESS })
    public getOwner(calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(32);
        writer.writeAddress(this.owner.value);
        return writer;
    }

    @method({ name: 'newOwner', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public transferOwnership(calldata: Calldata): BytesWriter {
        const sender = Blockchain.tx.sender;
        if (sender !== this.owner.value) {
            throw new Revert('Only owner');
        }

        const newOwner: Address = calldata.readAddress();
        this.owner.value = newOwner;

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ========================================
    // Internal Storage Helpers
    // ========================================

    private setMarketAddress(marketId: u256, address: Address): void {
        const keyWriter = new BytesWriter(32);
        keyWriter.writeU256(marketId);
        const key = encodePointerUnknownLength(this.marketAddressesBasePointer, keyWriter.getBuffer());
        Blockchain.setStorageAt(key, address);
    }

    private getMarketAddress(marketId: u256): Address {
        const keyWriter = new BytesWriter(32);
        keyWriter.writeU256(marketId);
        const key = encodePointerUnknownLength(this.marketAddressesBasePointer, keyWriter.getBuffer());
        return changetype<Address>(Blockchain.getStorageAt(key));
    }

    private setMarketActive(marketId: u256, active: bool): void {
        const keyWriter = new BytesWriter(32);
        keyWriter.writeU256(marketId);
        const key = encodePointerUnknownLength(this.marketActiveBasePointer, keyWriter.getBuffer());
        const value = new Uint8Array(32);
        if (active) {
            value[31] = 1;
        }
        Blockchain.setStorageAt(key, value);
    }

    private getMarketActive(marketId: u256): bool {
        const keyWriter = new BytesWriter(32);
        keyWriter.writeU256(marketId);
        const key = encodePointerUnknownLength(this.marketActiveBasePointer, keyWriter.getBuffer());
        const raw = Blockchain.getStorageAt(key);
        return raw[31] == 1;
    }
}
