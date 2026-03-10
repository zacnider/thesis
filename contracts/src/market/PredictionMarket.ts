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
    AddressMemoryMap,
    SafeMath,
    TransferHelper,
    EMPTY_POINTER,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

@final
export class PredictionMarket extends OP_NET {
    private static readonly PRECISION: u256 = u256.fromString('1000000000000000000');
    private static readonly FEE_DENOMINATOR: u256 = u256.fromU64(10000);

    // Storage pointers
    private readonly ownerPointer: u16 = Blockchain.nextPointer;
    private readonly yesTokenPointer: u16 = Blockchain.nextPointer;
    private readonly noTokenPointer: u16 = Blockchain.nextPointer;
    private readonly collateralTokenPointer: u16 = Blockchain.nextPointer;
    private readonly yesReservePointer: u16 = Blockchain.nextPointer;
    private readonly noReservePointer: u16 = Blockchain.nextPointer;
    private readonly kConstantPointer: u16 = Blockchain.nextPointer;
    private readonly totalCollateralPointer: u16 = Blockchain.nextPointer;
    private readonly feeRatePointer: u16 = Blockchain.nextPointer;
    private readonly accumulatedFeesPointer: u16 = Blockchain.nextPointer;
    private readonly endBlockPointer: u16 = Blockchain.nextPointer;
    private readonly resolvedPointer: u16 = Blockchain.nextPointer;
    private readonly winningOutcomePointer: u16 = Blockchain.nextPointer;
    private readonly totalTradesPointer: u16 = Blockchain.nextPointer;
    private readonly totalVolumePointer: u16 = Blockchain.nextPointer;
    private readonly tokensSetPointer: u16 = Blockchain.nextPointer;

    // Storage fields
    private owner: StoredAddress = new StoredAddress(this.ownerPointer);
    private yesToken: StoredAddress = new StoredAddress(this.yesTokenPointer);
    private noToken: StoredAddress = new StoredAddress(this.noTokenPointer);
    private collateralToken: StoredAddress = new StoredAddress(this.collateralTokenPointer);
    private yesReserve: StoredU256 = new StoredU256(this.yesReservePointer, EMPTY_POINTER);
    private noReserve: StoredU256 = new StoredU256(this.noReservePointer, EMPTY_POINTER);
    private kConstant: StoredU256 = new StoredU256(this.kConstantPointer, EMPTY_POINTER);
    private totalCollateral: StoredU256 = new StoredU256(this.totalCollateralPointer, EMPTY_POINTER);
    private feeRate: StoredU256 = new StoredU256(this.feeRatePointer, EMPTY_POINTER);
    private accumulatedFees: StoredU256 = new StoredU256(this.accumulatedFeesPointer, EMPTY_POINTER);
    private endBlock: StoredU256 = new StoredU256(this.endBlockPointer, EMPTY_POINTER);
    private resolved: StoredBoolean = new StoredBoolean(this.resolvedPointer, false);
    private winningOutcome: StoredU256 = new StoredU256(this.winningOutcomePointer, EMPTY_POINTER);
    private totalTrades: StoredU256 = new StoredU256(this.totalTradesPointer, EMPTY_POINTER);
    private totalVolume: StoredU256 = new StoredU256(this.totalVolumePointer, EMPTY_POINTER);
    private tokensSet: StoredBoolean = new StoredBoolean(this.tokensSetPointer, false);

    constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        const collateralAddr: Address = calldata.readAddress();
        const initialLiquidity: u256 = calldata.readU256();
        const feeRateValue: u256 = calldata.readU256();
        const endBlockValue: u256 = calldata.readU256();

        this.owner.value = Blockchain.tx.sender;
        this.collateralToken.value = collateralAddr;
        this.yesReserve.value = initialLiquidity;
        this.noReserve.value = initialLiquidity;
        this.kConstant.value = SafeMath.mul(initialLiquidity, initialLiquidity);
        this.totalCollateral.value = u256.Zero;
        this.feeRate.value = feeRateValue;
        this.accumulatedFees.value = u256.Zero;
        this.endBlock.value = endBlockValue;
        this.resolved.value = false;
        this.winningOutcome.value = u256.Zero;
        this.totalTrades.value = u256.Zero;
        this.totalVolume.value = u256.Zero;
        this.tokensSet.value = false;
    }

    @method(
        { name: 'yesToken', type: ABIDataTypes.ADDRESS },
        { name: 'noToken', type: ABIDataTypes.ADDRESS },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public setTokenAddresses(calldata: Calldata): BytesWriter {
        const sender = Blockchain.tx.sender;
        if (sender !== this.owner.value) {
            throw new Revert('Only owner');
        }
        if (this.tokensSet.value) {
            throw new Revert('Tokens already set');
        }

        const yesTokenAddr: Address = calldata.readAddress();
        const noTokenAddr: Address = calldata.readAddress();

        this.yesToken.value = yesTokenAddr;
        this.noToken.value = noTokenAddr;
        this.tokensSet.value = true;

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ========================================
    // CPMM Core: buyOutcome
    // YES_reserve * NO_reserve = k
    // ========================================

    @method(
        { name: 'isYes', type: ABIDataTypes.BOOL },
        { name: 'collateralAmount', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'tokensOut', type: ABIDataTypes.UINT256 })
    public buyOutcome(calldata: Calldata): BytesWriter {
        const isYes: bool = calldata.readBoolean();
        const collateralAmount: u256 = calldata.readU256();

        if (collateralAmount == u256.Zero) {
            throw new Revert('Amount must be greater than zero');
        }
        if (this.resolved.value) {
            throw new Revert('Market is resolved');
        }

        const sender = Blockchain.tx.sender;

        // Take collateral from user
        TransferHelper.transferFrom(
            this.collateralToken.value,
            sender,
            Blockchain.contractAddress,
            collateralAmount,
        );

        // Apply fee
        const fee: u256 = SafeMath.div(
            SafeMath.mul(collateralAmount, this.feeRate.value),
            PredictionMarket.FEE_DENOMINATOR,
        );
        const netAmount: u256 = SafeMath.sub(collateralAmount, fee);
        this.accumulatedFees.value = SafeMath.add(this.accumulatedFees.value, fee);

        // CPMM pricing
        let tokensOut: u256;
        const yesRes = this.yesReserve.value;
        const noRes = this.noReserve.value;
        const k = this.kConstant.value;

        if (isYes) {
            // Buying YES: add to NO reserve, calculate new YES reserve from k
            const newNoReserve = SafeMath.add(noRes, netAmount);
            const newYesReserve = SafeMath.div(k, newNoReserve);
            tokensOut = SafeMath.sub(yesRes, newYesReserve);
            this.yesReserve.value = newYesReserve;
            this.noReserve.value = newNoReserve;
        } else {
            // Buying NO: add to YES reserve, calculate new NO reserve from k
            const newYesReserve = SafeMath.add(yesRes, netAmount);
            const newNoReserve = SafeMath.div(k, newYesReserve);
            tokensOut = SafeMath.sub(noRes, newNoReserve);
            this.yesReserve.value = newYesReserve;
            this.noReserve.value = newNoReserve;
        }

        if (tokensOut == u256.Zero) {
            throw new Revert('Insufficient output');
        }

        // Transfer outcome tokens to user
        const tokenAddr = isYes ? this.yesToken.value : this.noToken.value;
        TransferHelper.transfer(tokenAddr, sender, tokensOut);

        // Update stats
        this.totalCollateral.value = SafeMath.add(this.totalCollateral.value, netAmount);
        this.totalTrades.value = SafeMath.add(this.totalTrades.value, u256.One);
        this.totalVolume.value = SafeMath.add(this.totalVolume.value, collateralAmount);

        const writer = new BytesWriter(32);
        writer.writeU256(tokensOut);
        return writer;
    }

    @method(
        { name: 'isYes', type: ABIDataTypes.BOOL },
        { name: 'tokenAmount', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'collateralOut', type: ABIDataTypes.UINT256 })
    public sellOutcome(calldata: Calldata): BytesWriter {
        const isYes: bool = calldata.readBoolean();
        const tokenAmount: u256 = calldata.readU256();

        if (tokenAmount == u256.Zero) {
            throw new Revert('Amount must be greater than zero');
        }
        if (this.resolved.value) {
            throw new Revert('Market is resolved');
        }

        const sender = Blockchain.tx.sender;

        // Take outcome tokens from user
        const tokenAddr = isYes ? this.yesToken.value : this.noToken.value;
        TransferHelper.transferFrom(
            tokenAddr,
            sender,
            Blockchain.contractAddress,
            tokenAmount,
        );

        // CPMM reverse pricing
        let collateralOut: u256;
        const yesRes = this.yesReserve.value;
        const noRes = this.noReserve.value;
        const k = this.kConstant.value;

        if (isYes) {
            // Selling YES: add to YES reserve, calculate new NO reserve
            const newYesReserve = SafeMath.add(yesRes, tokenAmount);
            const newNoReserve = SafeMath.div(k, newYesReserve);
            collateralOut = SafeMath.sub(noRes, newNoReserve);
            this.yesReserve.value = newYesReserve;
            this.noReserve.value = newNoReserve;
        } else {
            // Selling NO: add to NO reserve, calculate new YES reserve
            const newNoReserve = SafeMath.add(noRes, tokenAmount);
            const newYesReserve = SafeMath.div(k, newNoReserve);
            collateralOut = SafeMath.sub(yesRes, newYesReserve);
            this.yesReserve.value = newYesReserve;
            this.noReserve.value = newNoReserve;
        }

        // Apply fee on output
        const fee: u256 = SafeMath.div(
            SafeMath.mul(collateralOut, this.feeRate.value),
            PredictionMarket.FEE_DENOMINATOR,
        );
        const netCollateral: u256 = SafeMath.sub(collateralOut, fee);
        this.accumulatedFees.value = SafeMath.add(this.accumulatedFees.value, fee);

        // Transfer collateral back to user
        TransferHelper.transfer(this.collateralToken.value, sender, netCollateral);

        // Update stats
        this.totalCollateral.value = SafeMath.sub(this.totalCollateral.value, collateralOut);
        this.totalTrades.value = SafeMath.add(this.totalTrades.value, u256.One);
        this.totalVolume.value = SafeMath.add(this.totalVolume.value, collateralOut);

        const writer = new BytesWriter(32);
        writer.writeU256(netCollateral);
        return writer;
    }

    // ========================================
    // Resolution & Redemption
    // ========================================

    @method({ name: 'outcome', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public resolve(calldata: Calldata): BytesWriter {
        const outcome: u256 = calldata.readU256();
        const sender = Blockchain.tx.sender;

        if (sender !== this.owner.value) {
            throw new Revert('Only owner can resolve');
        }
        if (this.resolved.value) {
            throw new Revert('Already resolved');
        }
        // outcome: 1 = YES, 2 = NO
        if (outcome != u256.One && outcome != u256.fromU64(2)) {
            throw new Revert('Invalid outcome: must be 1 (YES) or 2 (NO)');
        }

        this.resolved.value = true;
        this.winningOutcome.value = outcome;

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @returns({ name: 'payout', type: ABIDataTypes.UINT256 })
    public redeem(calldata: Calldata): BytesWriter {
        if (!this.resolved.value) {
            throw new Revert('Market not resolved');
        }

        const amount: u256 = calldata.readU256();
        if (amount == u256.Zero) {
            throw new Revert('Amount must be greater than zero');
        }

        const sender = Blockchain.tx.sender;
        const outcome = this.winningOutcome.value;

        // Determine winning token
        const winningToken = outcome == u256.One
            ? this.yesToken.value
            : this.noToken.value;

        // Take winning tokens from user
        TransferHelper.transferFrom(
            winningToken,
            sender,
            Blockchain.contractAddress,
            amount,
        );

        // Pay out collateral 1:1
        TransferHelper.transfer(this.collateralToken.value, sender, amount);

        const writer = new BytesWriter(32);
        writer.writeU256(amount);
        return writer;
    }

    // ========================================
    // View Methods
    // ========================================

    @method()
    @returns(
        { name: 'yesPrice', type: ABIDataTypes.UINT256 },
        { name: 'noPrice', type: ABIDataTypes.UINT256 },
    )
    public getPrice(calldata: Calldata): BytesWriter {
        const yesRes = this.yesReserve.value;
        const noRes = this.noReserve.value;
        const total = SafeMath.add(yesRes, noRes);

        // yesPrice = noReserve / (yesReserve + noReserve) * PRECISION
        const yesPrice = SafeMath.div(
            SafeMath.mul(noRes, PredictionMarket.PRECISION),
            total,
        );
        // noPrice = yesReserve / (yesReserve + noReserve) * PRECISION
        const noPrice = SafeMath.div(
            SafeMath.mul(yesRes, PredictionMarket.PRECISION),
            total,
        );

        const writer = new BytesWriter(64);
        writer.writeU256(yesPrice);
        writer.writeU256(noPrice);
        return writer;
    }

    @method()
    @returns(
        { name: 'yesReserve', type: ABIDataTypes.UINT256 },
        { name: 'noReserve', type: ABIDataTypes.UINT256 },
        { name: 'totalCollateral', type: ABIDataTypes.UINT256 },
        { name: 'totalTrades', type: ABIDataTypes.UINT256 },
        { name: 'totalVolume', type: ABIDataTypes.UINT256 },
        { name: 'feeRate', type: ABIDataTypes.UINT256 },
        { name: 'endBlock', type: ABIDataTypes.UINT256 },
        { name: 'resolved', type: ABIDataTypes.BOOL },
        { name: 'winningOutcome', type: ABIDataTypes.UINT256 },
        { name: 'accumulatedFees', type: ABIDataTypes.UINT256 },
    )
    public getMarketInfo(calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(32 * 9 + 1); // 9 x U256 + 1 BOOL = 289
        writer.writeU256(this.yesReserve.value);
        writer.writeU256(this.noReserve.value);
        writer.writeU256(this.totalCollateral.value);
        writer.writeU256(this.totalTrades.value);
        writer.writeU256(this.totalVolume.value);
        writer.writeU256(this.feeRate.value);
        writer.writeU256(this.endBlock.value);
        writer.writeBoolean(this.resolved.value);
        writer.writeU256(this.winningOutcome.value);
        writer.writeU256(this.accumulatedFees.value);
        return writer;
    }

    @method(
        { name: 'isYes', type: ABIDataTypes.BOOL },
        { name: 'collateralAmount', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'tokensOut', type: ABIDataTypes.UINT256 })
    public getQuote(calldata: Calldata): BytesWriter {
        const isYes: bool = calldata.readBoolean();
        const collateralAmount: u256 = calldata.readU256();

        const fee: u256 = SafeMath.div(
            SafeMath.mul(collateralAmount, this.feeRate.value),
            PredictionMarket.FEE_DENOMINATOR,
        );
        const netAmount: u256 = SafeMath.sub(collateralAmount, fee);

        let tokensOut: u256;
        const yesRes = this.yesReserve.value;
        const noRes = this.noReserve.value;
        const k = this.kConstant.value;

        if (isYes) {
            const newNoReserve = SafeMath.add(noRes, netAmount);
            const newYesReserve = SafeMath.div(k, newNoReserve);
            tokensOut = SafeMath.sub(yesRes, newYesReserve);
        } else {
            const newYesReserve = SafeMath.add(yesRes, netAmount);
            const newNoReserve = SafeMath.div(k, newYesReserve);
            tokensOut = SafeMath.sub(noRes, newNoReserve);
        }

        const writer = new BytesWriter(32);
        writer.writeU256(tokensOut);
        return writer;
    }

    @method({ name: 'feeRate', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public setFeeRate(calldata: Calldata): BytesWriter {
        const sender = Blockchain.tx.sender;
        if (sender !== this.owner.value) {
            throw new Revert('Only owner');
        }
        const newRate: u256 = calldata.readU256();
        // Max 5% = 500 basis points
        if (newRate > u256.fromU64(500)) {
            throw new Revert('Fee rate too high (max 500 bps)');
        }
        this.feeRate.value = newRate;

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    @method()
    @returns({ name: 'fees', type: ABIDataTypes.UINT256 })
    public withdrawFees(calldata: Calldata): BytesWriter {
        const sender = Blockchain.tx.sender;
        if (sender !== this.owner.value) {
            throw new Revert('Only owner');
        }

        const fees = this.accumulatedFees.value;
        if (fees == u256.Zero) {
            throw new Revert('No fees to withdraw');
        }

        this.accumulatedFees.value = u256.Zero;
        TransferHelper.transfer(this.collateralToken.value, sender, fees);

        const writer = new BytesWriter(32);
        writer.writeU256(fees);
        return writer;
    }
}
