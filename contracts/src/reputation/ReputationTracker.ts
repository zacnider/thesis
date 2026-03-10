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
export class ReputationTracker extends OP_NET {
    // Storage pointers
    private readonly ownerPointer: u16 = Blockchain.nextPointer;
    private readonly totalUsersPointer: u16 = Blockchain.nextPointer;

    // Per-user stats (keyed by user address)
    private readonly totalPredictionsBasePointer: u16 = Blockchain.nextPointer;
    private readonly correctPredictionsBasePointer: u16 = Blockchain.nextPointer;
    private readonly winStreakBasePointer: u16 = Blockchain.nextPointer;
    private readonly bestStreakBasePointer: u16 = Blockchain.nextPointer;
    private readonly totalProfitBasePointer: u16 = Blockchain.nextPointer;
    private readonly isRegisteredBasePointer: u16 = Blockchain.nextPointer;

    // Storage fields
    private owner: StoredAddress = new StoredAddress(this.ownerPointer);
    private totalUsers: StoredU256 = new StoredU256(this.totalUsersPointer, EMPTY_POINTER);

    constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        this.owner.value = Blockchain.tx.sender;
        this.totalUsers.value = u256.Zero;
    }

    // ========================================
    // Recording Methods (owner-only — called by backend)
    // ========================================

    @method(
        { name: 'user', type: ABIDataTypes.ADDRESS },
        { name: 'marketAddress', type: ABIDataTypes.ADDRESS },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public recordPrediction(calldata: Calldata): BytesWriter {
        const sender = Blockchain.tx.sender;
        if (sender !== this.owner.value) {
            throw new Revert('Only owner');
        }

        const user: Address = calldata.readAddress();
        const _market: Address = calldata.readAddress();

        // Register user if new
        if (!this.getUserRegistered(user)) {
            this.setUserRegistered(user, true);
            this.totalUsers.value = SafeMath.add(this.totalUsers.value, u256.One);
        }

        // Increment total predictions
        const current = this.getUserTotalPredictions(user);
        this.setUserTotalPredictions(user, SafeMath.add(current, u256.One));

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    @method(
        { name: 'user', type: ABIDataTypes.ADDRESS },
        { name: 'isCorrect', type: ABIDataTypes.BOOL },
        { name: 'profitAmount', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public recordResolution(calldata: Calldata): BytesWriter {
        const sender = Blockchain.tx.sender;
        if (sender !== this.owner.value) {
            throw new Revert('Only owner');
        }

        const user: Address = calldata.readAddress();
        const isCorrect: bool = calldata.readBoolean();
        const profitAmount: u256 = calldata.readU256();

        if (isCorrect) {
            // Increment correct predictions
            const correct = this.getUserCorrectPredictions(user);
            this.setUserCorrectPredictions(user, SafeMath.add(correct, u256.One));

            // Increment win streak
            const streak = this.getUserWinStreak(user);
            const newStreak = SafeMath.add(streak, u256.One);
            this.setUserWinStreak(user, newStreak);

            // Update best streak if needed
            const best = this.getUserBestStreak(user);
            if (newStreak > best) {
                this.setUserBestStreak(user, newStreak);
            }

            // Add profit
            const profit = this.getUserTotalProfit(user);
            this.setUserTotalProfit(user, SafeMath.add(profit, profitAmount));
        } else {
            // Reset win streak
            this.setUserWinStreak(user, u256.Zero);
        }

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ========================================
    // View Methods
    // ========================================

    @method({ name: 'user', type: ABIDataTypes.ADDRESS })
    @returns(
        { name: 'totalPredictions', type: ABIDataTypes.UINT256 },
        { name: 'correctPredictions', type: ABIDataTypes.UINT256 },
        { name: 'winStreak', type: ABIDataTypes.UINT256 },
        { name: 'bestStreak', type: ABIDataTypes.UINT256 },
        { name: 'totalProfit', type: ABIDataTypes.UINT256 },
    )
    public getUserStats(calldata: Calldata): BytesWriter {
        const user: Address = calldata.readAddress();

        const writer = new BytesWriter(160);
        writer.writeU256(this.getUserTotalPredictions(user));
        writer.writeU256(this.getUserCorrectPredictions(user));
        writer.writeU256(this.getUserWinStreak(user));
        writer.writeU256(this.getUserBestStreak(user));
        writer.writeU256(this.getUserTotalProfit(user));
        return writer;
    }

    @method()
    @returns({ name: 'totalUsers', type: ABIDataTypes.UINT256 })
    public getTotalUsers(calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(32);
        writer.writeU256(this.totalUsers.value);
        return writer;
    }

    @method({ name: 'user', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'accuracy', type: ABIDataTypes.UINT256 })
    public getAccuracy(calldata: Calldata): BytesWriter {
        const user: Address = calldata.readAddress();

        const total = this.getUserTotalPredictions(user);
        const correct = this.getUserCorrectPredictions(user);

        let accuracy = u256.Zero;
        if (total > u256.Zero) {
            // accuracy = (correct * 10000) / total (basis points)
            accuracy = SafeMath.div(
                SafeMath.mul(correct, u256.fromU64(10000)),
                total,
            );
        }

        const writer = new BytesWriter(32);
        writer.writeU256(accuracy);
        return writer;
    }

    // ========================================
    // Internal Storage Helpers
    // ========================================

    private _userKey(basePointer: u16, user: Address): Uint8Array {
        const keyWriter = new BytesWriter(32);
        keyWriter.writeAddress(user);
        return encodePointerUnknownLength(basePointer, keyWriter.getBuffer());
    }

    private getUserTotalPredictions(user: Address): u256 {
        const key = this._userKey(this.totalPredictionsBasePointer, user);
        return u256.fromUint8ArrayBE(Blockchain.getStorageAt(key));
    }

    private setUserTotalPredictions(user: Address, value: u256): void {
        const key = this._userKey(this.totalPredictionsBasePointer, user);
        Blockchain.setStorageAt(key, value.toUint8Array(true));
    }

    private getUserCorrectPredictions(user: Address): u256 {
        const key = this._userKey(this.correctPredictionsBasePointer, user);
        return u256.fromUint8ArrayBE(Blockchain.getStorageAt(key));
    }

    private setUserCorrectPredictions(user: Address, value: u256): void {
        const key = this._userKey(this.correctPredictionsBasePointer, user);
        Blockchain.setStorageAt(key, value.toUint8Array(true));
    }

    private getUserWinStreak(user: Address): u256 {
        const key = this._userKey(this.winStreakBasePointer, user);
        return u256.fromUint8ArrayBE(Blockchain.getStorageAt(key));
    }

    private setUserWinStreak(user: Address, value: u256): void {
        const key = this._userKey(this.winStreakBasePointer, user);
        Blockchain.setStorageAt(key, value.toUint8Array(true));
    }

    private getUserBestStreak(user: Address): u256 {
        const key = this._userKey(this.bestStreakBasePointer, user);
        return u256.fromUint8ArrayBE(Blockchain.getStorageAt(key));
    }

    private setUserBestStreak(user: Address, value: u256): void {
        const key = this._userKey(this.bestStreakBasePointer, user);
        Blockchain.setStorageAt(key, value.toUint8Array(true));
    }

    private getUserTotalProfit(user: Address): u256 {
        const key = this._userKey(this.totalProfitBasePointer, user);
        return u256.fromUint8ArrayBE(Blockchain.getStorageAt(key));
    }

    private setUserTotalProfit(user: Address, value: u256): void {
        const key = this._userKey(this.totalProfitBasePointer, user);
        Blockchain.setStorageAt(key, value.toUint8Array(true));
    }

    private getUserRegistered(user: Address): bool {
        const key = this._userKey(this.isRegisteredBasePointer, user);
        const raw = Blockchain.getStorageAt(key);
        return raw[31] == 1;
    }

    private setUserRegistered(user: Address, registered: bool): void {
        const key = this._userKey(this.isRegisteredBasePointer, user);
        const value = new Uint8Array(32);
        if (registered) {
            value[31] = 1;
        }
        Blockchain.setStorageAt(key, value);
    }
}
