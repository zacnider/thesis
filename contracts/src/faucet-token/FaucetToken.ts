import {
    Address,
    Blockchain,
    BytesWriter,
    Calldata,
    OP20,
    OP20InitParameters,
    Revert,
    StoredAddress,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

const FAUCET_AMOUNT: u256 = u256.fromString('1000000000000000000000'); // 1000 tokens (1000e18)

@final
export class FaucetToken extends OP20 {
    private ownerPointer: u16 = Blockchain.nextPointer;
    private owner: StoredAddress = new StoredAddress(this.ownerPointer);

    constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        const tokenName: string = calldata.readStringWithLength();
        const tokenSymbol: string = calldata.readStringWithLength();
        const maxSupply: u256 = calldata.readU256();
        const decimals: u8 = calldata.readU8();

        this.instantiate(new OP20InitParameters(maxSupply, decimals, tokenName, tokenSymbol, ''));

        // Store deployer as owner
        this.owner.value = Blockchain.tx.sender;
    }

    // Users call this to get 1000 tUSDT
    @method()
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public faucet(calldata: Calldata): BytesWriter {
        this._mint(Blockchain.tx.sender, FAUCET_AMOUNT);

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // Owner-only: mint any amount to any address (for funding LendingPools)
    @method({ name: 'to', type: ABIDataTypes.ADDRESS }, { name: 'amount', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public adminMint(calldata: Calldata): BytesWriter {
        const sender: Address = Blockchain.tx.sender;
        if (sender !== this.owner.value) {
            throw new Revert('Only owner can adminMint');
        }

        const to: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();

        this._mint(to, amount);

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }
}
