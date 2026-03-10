import {
    Blockchain,
    BytesWriter,
    Calldata,
    OP20,
    OP20InitParameters,
    Address,
    Revert,
    StoredAddress,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

@final
export class OutcomeToken extends OP20 {
    private readonly marketAddressPointer: u16 = Blockchain.nextPointer;

    private marketAddress: StoredAddress = new StoredAddress(this.marketAddressPointer);

    constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        const tokenName: string = calldata.readStringWithLength();
        const tokenSymbol: string = calldata.readStringWithLength();
        const maxSupply: u256 = calldata.readU256();
        const decimals: u8 = calldata.readU8();
        const marketAddr: Address = calldata.readAddress();

        this.instantiate(new OP20InitParameters(maxSupply, decimals, tokenName, tokenSymbol, ''));

        this.marketAddress.value = marketAddr;

        // Mint all tokens to deployer, then transfer to market contract
        this._mint(Blockchain.tx.sender, maxSupply);
        this._transfer(Blockchain.tx.sender, marketAddr, maxSupply);
    }

    @method()
    @returns({ name: 'marketAddress', type: ABIDataTypes.ADDRESS })
    public getMarketAddress(calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(32);
        writer.writeAddress(this.marketAddress.value);
        return writer;
    }
}
