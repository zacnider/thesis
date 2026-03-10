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

const LTV_DENOMINATOR: u256 = u256.fromU64(10000);
const BLOCKS_PER_YEAR: u256 = u256.fromU64(52560); // 144 blocks/day * 365

@final
export class LendingPool extends OP_NET {
    private static readonly PRECISION: u256 = u256.fromString('1000000000000000000');

    // ========================================
    // Storage pointers
    // ========================================
    private readonly ownerPointer: u16 = Blockchain.nextPointer;
    private readonly marketAddressPointer: u16 = Blockchain.nextPointer;
    private readonly yesTokenPointer: u16 = Blockchain.nextPointer;
    private readonly noTokenPointer: u16 = Blockchain.nextPointer;
    private readonly ltvNumeratorPointer: u16 = Blockchain.nextPointer;
    private readonly interestRatePointer: u16 = Blockchain.nextPointer;
    private readonly resolvedPointer: u16 = Blockchain.nextPointer;
    private readonly winningOutcomePointer: u16 = Blockchain.nextPointer;
    private readonly yesPricePointer: u16 = Blockchain.nextPointer;
    private readonly noPricePointer: u16 = Blockchain.nextPointer;
    private readonly totalYesCollateralPointer: u16 = Blockchain.nextPointer;
    private readonly totalNoCollateralPointer: u16 = Blockchain.nextPointer;
    private readonly totalBorrowedPointer: u16 = Blockchain.nextPointer;
    private readonly loanCountPointer: u16 = Blockchain.nextPointer;

    // Per-user keyed storage base pointers
    private readonly userYesCollateralBasePointer: u16 = Blockchain.nextPointer;
    private readonly userNoCollateralBasePointer: u16 = Blockchain.nextPointer;
    private readonly userBorrowedBasePointer: u16 = Blockchain.nextPointer;
    private readonly userBorrowBlockBasePointer: u16 = Blockchain.nextPointer;

    // ========================================
    // Storage fields
    // ========================================
    private owner: StoredAddress = new StoredAddress(this.ownerPointer);
    private marketAddress: StoredAddress = new StoredAddress(this.marketAddressPointer);
    private yesToken: StoredAddress = new StoredAddress(this.yesTokenPointer);
    private noToken: StoredAddress = new StoredAddress(this.noTokenPointer);
    private ltvNumerator: StoredU256 = new StoredU256(this.ltvNumeratorPointer, EMPTY_POINTER);
    private interestRate: StoredU256 = new StoredU256(this.interestRatePointer, EMPTY_POINTER);
    private resolved: StoredBoolean = new StoredBoolean(this.resolvedPointer, false);
    private winningOutcome: StoredU256 = new StoredU256(this.winningOutcomePointer, EMPTY_POINTER);
    private yesPrice: StoredU256 = new StoredU256(this.yesPricePointer, EMPTY_POINTER);
    private noPrice: StoredU256 = new StoredU256(this.noPricePointer, EMPTY_POINTER);
    private totalYesCollateral: StoredU256 = new StoredU256(this.totalYesCollateralPointer, EMPTY_POINTER);
    private totalNoCollateral: StoredU256 = new StoredU256(this.totalNoCollateralPointer, EMPTY_POINTER);
    private totalBorrowed: StoredU256 = new StoredU256(this.totalBorrowedPointer, EMPTY_POINTER);
    private loanCount: StoredU256 = new StoredU256(this.loanCountPointer, EMPTY_POINTER);

    constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        const marketAddr: Address = calldata.readAddress();
        const yesTokenAddr: Address = calldata.readAddress();
        const noTokenAddr: Address = calldata.readAddress();
        const ltv: u256 = calldata.readU256();
        const rate: u256 = calldata.readU256();

        this.owner.value = Blockchain.tx.sender;
        this.marketAddress.value = marketAddr;
        this.yesToken.value = yesTokenAddr;
        this.noToken.value = noTokenAddr;
        this.ltvNumerator.value = ltv;
        this.interestRate.value = rate;
        this.resolved.value = false;
        this.winningOutcome.value = u256.Zero;
        // Initial prices: 50/50
        this.yesPrice.value = SafeMath.div(LendingPool.PRECISION, u256.fromU64(2));
        this.noPrice.value = SafeMath.div(LendingPool.PRECISION, u256.fromU64(2));
        this.totalYesCollateral.value = u256.Zero;
        this.totalNoCollateral.value = u256.Zero;
        this.totalBorrowed.value = u256.Zero;
        this.loanCount.value = u256.Zero;
    }

    // ========================================
    // depositCollateral — deposit YES or NO tokens
    // ========================================
    @method(
        { name: 'isYes', type: ABIDataTypes.BOOL },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public depositCollateral(calldata: Calldata): BytesWriter {
        const isYes: bool = calldata.readBoolean();
        const amount: u256 = calldata.readU256();

        if (amount == u256.Zero) {
            throw new Revert('Amount must be greater than zero');
        }
        if (this.resolved.value) {
            throw new Revert('Market is resolved');
        }

        const sender = Blockchain.tx.sender;
        const tokenAddr = isYes ? this.yesToken.value : this.noToken.value;

        // Take tokens from user
        TransferHelper.transferFrom(tokenAddr, sender, Blockchain.contractAddress, amount);

        // Update per-user collateral
        if (isYes) {
            const current = this.getUserYesCollateral(sender);
            this.setUserYesCollateral(sender, SafeMath.add(current, amount));
            this.totalYesCollateral.value = SafeMath.add(this.totalYesCollateral.value, amount);
        } else {
            const current = this.getUserNoCollateral(sender);
            this.setUserNoCollateral(sender, SafeMath.add(current, amount));
            this.totalNoCollateral.value = SafeMath.add(this.totalNoCollateral.value, amount);
        }

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ========================================
    // withdrawCollateral — withdraw if no active loan or remaining covers loan
    // ========================================
    @method(
        { name: 'isYes', type: ABIDataTypes.BOOL },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public withdrawCollateral(calldata: Calldata): BytesWriter {
        const isYes: bool = calldata.readBoolean();
        const amount: u256 = calldata.readU256();

        if (amount == u256.Zero) {
            throw new Revert('Amount must be greater than zero');
        }

        const sender = Blockchain.tx.sender;

        // Check sufficient collateral
        if (isYes) {
            const current = this.getUserYesCollateral(sender);
            if (amount > current) {
                throw new Revert('Insufficient YES collateral');
            }
        } else {
            const current = this.getUserNoCollateral(sender);
            if (amount > current) {
                throw new Revert('Insufficient NO collateral');
            }
        }

        // Check remaining collateral still covers borrow
        const borrowed = this.getUserBorrowed(sender);
        if (borrowed > u256.Zero) {
            const yesCol = this.getUserYesCollateral(sender);
            const noCol = this.getUserNoCollateral(sender);
            // Simulate withdrawal
            const newYes = isYes ? SafeMath.sub(yesCol, amount) : yesCol;
            const newNo = isYes ? noCol : SafeMath.sub(noCol, amount);
            const newValue = this._calcCollateralValue(newYes, newNo);
            const maxBorrow = SafeMath.div(SafeMath.mul(newValue, this.ltvNumerator.value), LTV_DENOMINATOR);
            if (borrowed > maxBorrow) {
                throw new Revert('Withdrawal would undercollateralize loan');
            }
        }

        // Transfer tokens back
        const tokenAddr = isYes ? this.yesToken.value : this.noToken.value;
        TransferHelper.transfer(tokenAddr, sender, amount);

        // Update storage
        if (isYes) {
            const current = this.getUserYesCollateral(sender);
            this.setUserYesCollateral(sender, SafeMath.sub(current, amount));
            this.totalYesCollateral.value = SafeMath.sub(this.totalYesCollateral.value, amount);
        } else {
            const current = this.getUserNoCollateral(sender);
            this.setUserNoCollateral(sender, SafeMath.sub(current, amount));
            this.totalNoCollateral.value = SafeMath.sub(this.totalNoCollateral.value, amount);
        }

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ========================================
    // borrow — borrow against collateral up to LTV
    // ========================================
    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public borrow(calldata: Calldata): BytesWriter {
        const amount: u256 = calldata.readU256();

        if (amount == u256.Zero) {
            throw new Revert('Amount must be greater than zero');
        }
        if (this.resolved.value) {
            throw new Revert('Market is resolved');
        }

        const sender = Blockchain.tx.sender;

        // Calculate max borrow
        const yesCol = this.getUserYesCollateral(sender);
        const noCol = this.getUserNoCollateral(sender);
        const collateralValue = this._calcCollateralValue(yesCol, noCol);
        const maxBorrow = SafeMath.div(SafeMath.mul(collateralValue, this.ltvNumerator.value), LTV_DENOMINATOR);

        const currentBorrow = this.getUserBorrowed(sender);
        const totalBorrow = SafeMath.add(currentBorrow, amount);

        if (totalBorrow > maxBorrow) {
            throw new Revert('Exceeds max borrow (LTV limit)');
        }

        // First borrow: set borrow block
        if (currentBorrow == u256.Zero) {
            this.setUserBorrowBlock(sender, Blockchain.block.numberU256);
            this.loanCount.value = SafeMath.add(this.loanCount.value, u256.One);
        }

        // Update borrow amount
        this.setUserBorrowed(sender, totalBorrow);
        this.totalBorrowed.value = SafeMath.add(this.totalBorrowed.value, amount);

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ========================================
    // repay — repay borrowed amount
    // ========================================
    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public repay(calldata: Calldata): BytesWriter {
        const amount: u256 = calldata.readU256();

        if (amount == u256.Zero) {
            throw new Revert('Amount must be greater than zero');
        }

        const sender = Blockchain.tx.sender;
        const currentBorrow = this.getUserBorrowed(sender);

        if (currentBorrow == u256.Zero) {
            throw new Revert('No active loan');
        }

        // Calculate interest
        const interest = this._calcInterest(sender);
        const totalOwed = SafeMath.add(currentBorrow, interest);

        // Determine actual repay amount (cap at total owed)
        const repayAmount = amount > totalOwed ? totalOwed : amount;

        // Update borrow: subtract repayment (interest first, then principal)
        if (repayAmount >= totalOwed) {
            // Full repayment
            this.totalBorrowed.value = SafeMath.sub(this.totalBorrowed.value, currentBorrow);
            this.setUserBorrowed(sender, u256.Zero);
            this.setUserBorrowBlock(sender, u256.Zero);
        } else {
            // Partial repayment
            const newBorrow = SafeMath.sub(totalOwed, repayAmount);
            this.totalBorrowed.value = SafeMath.sub(this.totalBorrowed.value, SafeMath.sub(currentBorrow, newBorrow));
            this.setUserBorrowed(sender, newBorrow);
            this.setUserBorrowBlock(sender, Blockchain.block.numberU256);
        }

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ========================================
    // setPrice — owner-only oracle price feed
    // ========================================
    @method(
        { name: 'yesPrice', type: ABIDataTypes.UINT256 },
        { name: 'noPrice', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public setPrice(calldata: Calldata): BytesWriter {
        const newYesPrice: u256 = calldata.readU256();
        const newNoPrice: u256 = calldata.readU256();

        if (Blockchain.tx.sender != this.owner.value) {
            throw new Revert('Only owner can set prices');
        }

        this.yesPrice.value = newYesPrice;
        this.noPrice.value = newNoPrice;

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ========================================
    // settleAfterResolution — handle market resolution
    // ========================================
    @method({ name: 'outcome', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public settleAfterResolution(calldata: Calldata): BytesWriter {
        const outcome: u256 = calldata.readU256();

        if (Blockchain.tx.sender != this.owner.value) {
            throw new Revert('Only owner');
        }
        if (outcome != u256.One && outcome != u256.fromU64(2)) {
            throw new Revert('Invalid outcome');
        }

        this.resolved.value = true;
        this.winningOutcome.value = outcome;

        // Winning tokens now worth 1:1 (PRECISION), losing tokens worth 0
        if (outcome == u256.One) {
            // YES wins
            this.yesPrice.value = LendingPool.PRECISION;
            this.noPrice.value = u256.Zero;
        } else {
            // NO wins
            this.yesPrice.value = u256.Zero;
            this.noPrice.value = LendingPool.PRECISION;
        }

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ========================================
    // getPositionInfo — view user position
    // ========================================
    @method({ name: 'user', type: ABIDataTypes.ADDRESS })
    @returns(
        { name: 'yesCollateral', type: ABIDataTypes.UINT256 },
        { name: 'noCollateral', type: ABIDataTypes.UINT256 },
        { name: 'borrowed', type: ABIDataTypes.UINT256 },
        { name: 'maxBorrow', type: ABIDataTypes.UINT256 },
        { name: 'interestOwed', type: ABIDataTypes.UINT256 },
    )
    public getPositionInfo(calldata: Calldata): BytesWriter {
        const user: Address = calldata.readAddress();

        const yesCol = this.getUserYesCollateral(user);
        const noCol = this.getUserNoCollateral(user);
        const borrowed = this.getUserBorrowed(user);
        const collateralValue = this._calcCollateralValue(yesCol, noCol);
        const maxBorrow = SafeMath.div(SafeMath.mul(collateralValue, this.ltvNumerator.value), LTV_DENOMINATOR);
        const interest = borrowed > u256.Zero ? this._calcInterest(user) : u256.Zero;

        const writer = new BytesWriter(160); // 5 * 32
        writer.writeU256(yesCol);
        writer.writeU256(noCol);
        writer.writeU256(borrowed);
        writer.writeU256(maxBorrow);
        writer.writeU256(interest);
        return writer;
    }

    // ========================================
    // getPoolInfo — view pool stats
    // ========================================
    @method()
    @returns(
        { name: 'totalYesCollateral', type: ABIDataTypes.UINT256 },
        { name: 'totalNoCollateral', type: ABIDataTypes.UINT256 },
        { name: 'totalBorrowed', type: ABIDataTypes.UINT256 },
        { name: 'loanCount', type: ABIDataTypes.UINT256 },
        { name: 'ltvNumerator', type: ABIDataTypes.UINT256 },
        { name: 'interestRate', type: ABIDataTypes.UINT256 },
        { name: 'resolved', type: ABIDataTypes.BOOL },
        { name: 'winningOutcome', type: ABIDataTypes.UINT256 },
    )
    public getPoolInfo(calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(225); // 6*32 + 1 + 32
        writer.writeU256(this.totalYesCollateral.value);
        writer.writeU256(this.totalNoCollateral.value);
        writer.writeU256(this.totalBorrowed.value);
        writer.writeU256(this.loanCount.value);
        writer.writeU256(this.ltvNumerator.value);
        writer.writeU256(this.interestRate.value);
        writer.writeBoolean(this.resolved.value);
        writer.writeU256(this.winningOutcome.value);
        return writer;
    }

    // ========================================
    // Internal: calculate collateral value
    // ========================================
    private _calcCollateralValue(yesCol: u256, noCol: u256): u256 {
        // value = yesCol * yesPrice / PRECISION + noCol * noPrice / PRECISION
        const yesValue = SafeMath.div(SafeMath.mul(yesCol, this.yesPrice.value), LendingPool.PRECISION);
        const noValue = SafeMath.div(SafeMath.mul(noCol, this.noPrice.value), LendingPool.PRECISION);
        return SafeMath.add(yesValue, noValue);
    }

    // ========================================
    // Internal: calculate interest owed
    // ========================================
    private _calcInterest(user: Address): u256 {
        const borrowed = this.getUserBorrowed(user);
        if (borrowed == u256.Zero) return u256.Zero;

        const borrowBlock = this.getUserBorrowBlock(user);
        if (borrowBlock == u256.Zero) return u256.Zero;

        const currentBlock = Blockchain.block.numberU256;
        if (currentBlock <= borrowBlock) return u256.Zero;

        const blockDiff = SafeMath.sub(currentBlock, borrowBlock);
        // interest = borrowed * interestRate * blockDiff / BLOCKS_PER_YEAR / 10000
        const numerator = SafeMath.mul(SafeMath.mul(borrowed, this.interestRate.value), blockDiff);
        const denominator = SafeMath.mul(BLOCKS_PER_YEAR, LTV_DENOMINATOR);
        return SafeMath.div(numerator, denominator);
    }

    // ========================================
    // Internal: per-user keyed storage helpers
    // ========================================
    private _userKey(basePointer: u16, user: Address): Uint8Array {
        const keyWriter = new BytesWriter(32);
        keyWriter.writeAddress(user);
        return encodePointerUnknownLength(basePointer, keyWriter.getBuffer());
    }

    private getUserYesCollateral(user: Address): u256 {
        const key = this._userKey(this.userYesCollateralBasePointer, user);
        return u256.fromUint8ArrayBE(Blockchain.getStorageAt(key));
    }

    private setUserYesCollateral(user: Address, value: u256): void {
        const key = this._userKey(this.userYesCollateralBasePointer, user);
        Blockchain.setStorageAt(key, value.toUint8Array(true));
    }

    private getUserNoCollateral(user: Address): u256 {
        const key = this._userKey(this.userNoCollateralBasePointer, user);
        return u256.fromUint8ArrayBE(Blockchain.getStorageAt(key));
    }

    private setUserNoCollateral(user: Address, value: u256): void {
        const key = this._userKey(this.userNoCollateralBasePointer, user);
        Blockchain.setStorageAt(key, value.toUint8Array(true));
    }

    private getUserBorrowed(user: Address): u256 {
        const key = this._userKey(this.userBorrowedBasePointer, user);
        return u256.fromUint8ArrayBE(Blockchain.getStorageAt(key));
    }

    private setUserBorrowed(user: Address, value: u256): void {
        const key = this._userKey(this.userBorrowedBasePointer, user);
        Blockchain.setStorageAt(key, value.toUint8Array(true));
    }

    private getUserBorrowBlock(user: Address): u256 {
        const key = this._userKey(this.userBorrowBlockBasePointer, user);
        return u256.fromUint8ArrayBE(Blockchain.getStorageAt(key));
    }

    private setUserBorrowBlock(user: Address, value: u256): void {
        const key = this._userKey(this.userBorrowBlockBasePointer, user);
        Blockchain.setStorageAt(key, value.toUint8Array(true));
    }
}
