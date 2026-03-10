import {
    Blockchain,
    BytesWriter,
    Calldata,
    OP20,
    OP20InitParameters,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

const FAUCET_AMOUNT: u256 = u256.fromString('1000000000000000000000'); // 1000 tokens (1000e18)

@final
export class FaucetToken extends OP20 {
    constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        const tokenName: string = calldata.readStringWithLength();
        const tokenSymbol: string = calldata.readStringWithLength();
        const maxSupply: u256 = calldata.readU256();
        const decimals: u8 = calldata.readU8();

        this.instantiate(new OP20InitParameters(maxSupply, decimals, tokenName, tokenSymbol, ''));
        // No initial mint — users mint via faucet()
    }

    @method()
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public faucet(calldata: Calldata): BytesWriter {
        this._mint(Blockchain.tx.sender, FAUCET_AMOUNT);

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }
}
