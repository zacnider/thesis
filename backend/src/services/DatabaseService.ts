import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/prophet.db');

export interface MarketRow {
    id: number;
    question: string;
    description: string;
    category: string;
    status: string; // 'active' | 'resolved' | 'disputed'
    end_block: number;
    collateral_token: string;
    market_address: string;
    market_pub_key: string;
    yes_token: string;
    yes_token_pub_key: string;
    no_token: string;
    no_token_pub_key: string;
    lending_pool_address: string;
    lending_pool_pub_key: string;
    creator: string;
    created_at: string;
    resolved_at: string | null;
    winning_outcome: number | null; // 1=YES, 2=NO
    ai_prediction: number | null; // 1=YES, 2=NO
    ai_confidence: number | null; // 0-100
    ai_reasoning: string | null;
    image_url: string | null;
}

export interface LendingPositionRow {
    id: number;
    market_id: number;
    borrower: string;
    yes_collateral: string;
    no_collateral: string;
    borrowed: string;
    interest_owed: string;
    status: string; // 'active' | 'liquidated' | 'closed'
    tx_hash: string;
    created_at: string;
    updated_at: string;
}

export interface TradeRow {
    id: number;
    market_id: number;
    trader: string;
    side: string; // 'YES' | 'NO'
    action: string; // 'buy' | 'sell'
    collateral_amount: string;
    token_amount: string;
    price: string;
    tx_hash: string;
    block_number: number;
    created_at: string;
}

export interface UserRow {
    address: string;
    total_predictions: number;
    correct_predictions: number;
    win_streak: number;
    best_streak: number;
    total_profit: string;
    updated_at: string;
}

class DatabaseService {
    private db!: Database.Database;

    init(): void {
        const dataDir = path.join(__dirname, '../../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        this.db = new Database(DB_PATH);
        this.db.pragma('journal_mode = WAL');
        this.createTables();
    }

    private createTables(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS markets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT NOT NULL,
                description TEXT DEFAULT '',
                category TEXT NOT NULL DEFAULT 'general',
                status TEXT NOT NULL DEFAULT 'active',
                end_block INTEGER NOT NULL,
                collateral_token TEXT NOT NULL,
                market_address TEXT DEFAULT '',
                market_pub_key TEXT DEFAULT '',
                yes_token TEXT DEFAULT '',
                yes_token_pub_key TEXT DEFAULT '',
                no_token TEXT DEFAULT '',
                no_token_pub_key TEXT DEFAULT '',
                lending_pool_address TEXT DEFAULT '',
                lending_pool_pub_key TEXT DEFAULT '',
                creator TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                resolved_at TEXT,
                winning_outcome INTEGER,
                ai_prediction INTEGER,
                ai_confidence INTEGER,
                ai_reasoning TEXT,
                image_url TEXT
            );

            CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                market_id INTEGER NOT NULL,
                trader TEXT NOT NULL,
                side TEXT NOT NULL,
                action TEXT NOT NULL DEFAULT 'buy',
                collateral_amount TEXT NOT NULL,
                token_amount TEXT NOT NULL,
                price TEXT NOT NULL,
                tx_hash TEXT NOT NULL,
                block_number INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (market_id) REFERENCES markets(id)
            );

            CREATE TABLE IF NOT EXISTS users (
                address TEXT PRIMARY KEY,
                total_predictions INTEGER NOT NULL DEFAULT 0,
                correct_predictions INTEGER NOT NULL DEFAULT 0,
                win_streak INTEGER NOT NULL DEFAULT 0,
                best_streak INTEGER NOT NULL DEFAULT 0,
                total_profit TEXT NOT NULL DEFAULT '0',
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS lending_positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                market_id INTEGER NOT NULL,
                borrower TEXT NOT NULL,
                yes_collateral TEXT NOT NULL DEFAULT '0',
                no_collateral TEXT NOT NULL DEFAULT '0',
                borrowed TEXT NOT NULL DEFAULT '0',
                interest_owed TEXT NOT NULL DEFAULT '0',
                status TEXT NOT NULL DEFAULT 'active',
                tx_hash TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (market_id) REFERENCES markets(id)
            );

            CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id);
            CREATE INDEX IF NOT EXISTS idx_trades_trader ON trades(trader);
            CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
            CREATE INDEX IF NOT EXISTS idx_markets_category ON markets(category);
            CREATE INDEX IF NOT EXISTS idx_lending_market ON lending_positions(market_id);
            CREATE INDEX IF NOT EXISTS idx_lending_borrower ON lending_positions(borrower);
        `);

        // Migration: add lending columns to existing markets table
        try {
            this.db.exec(`ALTER TABLE markets ADD COLUMN lending_pool_address TEXT DEFAULT ''`);
        } catch {}
        try {
            this.db.exec(`ALTER TABLE markets ADD COLUMN lending_pool_pub_key TEXT DEFAULT ''`);
        } catch {}
    }

    // ========================================
    // Markets
    // ========================================

    createMarket(market: Partial<MarketRow>): number {
        const stmt = this.db.prepare(`
            INSERT INTO markets (question, description, category, end_block, collateral_token, creator, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            market.question,
            market.description || '',
            market.category || 'general',
            market.end_block,
            market.collateral_token,
            market.creator,
            market.image_url || null,
        );
        return result.lastInsertRowid as number;
    }

    updateMarketAddresses(id: number, data: {
        market_address: string;
        market_pub_key: string;
        yes_token: string;
        yes_token_pub_key: string;
        no_token: string;
        no_token_pub_key: string;
        lending_pool_address?: string;
        lending_pool_pub_key?: string;
    }): void {
        this.db.prepare(`
            UPDATE markets SET market_address = ?, market_pub_key = ?,
            yes_token = ?, yes_token_pub_key = ?,
            no_token = ?, no_token_pub_key = ?,
            lending_pool_address = ?, lending_pool_pub_key = ?
            WHERE id = ?
        `).run(
            data.market_address, data.market_pub_key,
            data.yes_token, data.yes_token_pub_key,
            data.no_token, data.no_token_pub_key,
            data.lending_pool_address || '', data.lending_pool_pub_key || '',
            id,
        );
    }

    getMarket(id: number): MarketRow | undefined {
        return this.db.prepare('SELECT * FROM markets WHERE id = ?').get(id) as MarketRow | undefined;
    }

    getMarkets(filters: { status?: string; category?: string; limit?: number; offset?: number }): MarketRow[] {
        let query = 'SELECT * FROM markets WHERE 1=1';
        const params: any[] = [];

        if (filters.status) {
            query += ' AND status = ?';
            params.push(filters.status);
        }
        if (filters.category) {
            query += ' AND category = ?';
            params.push(filters.category);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(filters.limit || 20);
        params.push(filters.offset || 0);

        return this.db.prepare(query).all(...params) as MarketRow[];
    }

    clearAllMarkets(): void {
        this.db.exec('DELETE FROM trades');
        this.db.exec('DELETE FROM markets');
        console.log('[DB] All markets and trades cleared');
    }

    getActiveMarketCount(): number {
        return (this.db.prepare("SELECT COUNT(*) as c FROM markets WHERE status = 'active'").get() as any).c;
    }

    getUndeployedMarkets(): Array<{ id: number; question: string; end_block: number }> {
        return this.db.prepare(
            "SELECT id, question, end_block FROM markets WHERE status = 'active' AND (market_address IS NULL OR market_address = '')"
        ).all() as Array<{ id: number; question: string; end_block: number }>;
    }

    getRecentMarketQuestions(limit: number = 20): string[] {
        const rows = this.db.prepare('SELECT question FROM markets ORDER BY created_at DESC LIMIT ?').all(limit) as { question: string }[];
        return rows.map(r => r.question);
    }

    questionExists(question: string): boolean {
        const row = this.db.prepare("SELECT COUNT(*) as c FROM markets WHERE LOWER(question) = LOWER(?)").get(question) as { c: number };
        return row.c > 0;
    }

    getAllMarketQuestions(): string[] {
        const rows = this.db.prepare('SELECT question FROM markets ORDER BY created_at DESC').all() as { question: string }[];
        return rows.map(r => r.question);
    }

    resolveMarket(id: number, outcome: number): void {
        this.db.prepare(`
            UPDATE markets SET status = 'resolved', winning_outcome = ?, resolved_at = datetime('now')
            WHERE id = ?
        `).run(outcome, id);
    }

    updateAIPrediction(id: number, prediction: number, confidence: number, reasoning: string): void {
        this.db.prepare(`
            UPDATE markets SET ai_prediction = ?, ai_confidence = ?, ai_reasoning = ?
            WHERE id = ?
        `).run(prediction, confidence, reasoning, id);
    }

    updateCollateralToken(id: number, collateralToken: string): void {
        this.db.prepare('UPDATE markets SET collateral_token = ? WHERE id = ?').run(collateralToken, id);
    }

    // ========================================
    // Trades
    // ========================================

    recordTrade(trade: Partial<TradeRow>): number {
        const stmt = this.db.prepare(`
            INSERT INTO trades (market_id, trader, side, action, collateral_amount, token_amount, price, tx_hash, block_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            trade.market_id,
            trade.trader,
            trade.side,
            trade.action || 'buy',
            trade.collateral_amount,
            trade.token_amount,
            trade.price,
            trade.tx_hash,
            trade.block_number || 0,
        );
        return result.lastInsertRowid as number;
    }

    getTradesByMarket(marketId: number, limit: number = 50): TradeRow[] {
        return this.db.prepare(
            'SELECT * FROM trades WHERE market_id = ? ORDER BY created_at DESC LIMIT ?',
        ).all(marketId, limit) as TradeRow[];
    }

    getTradesByUser(address: string, limit: number = 50): TradeRow[] {
        return this.db.prepare(
            'SELECT * FROM trades WHERE trader = ? ORDER BY created_at DESC LIMIT ?',
        ).all(address, limit) as TradeRow[];
    }

    // ========================================
    // Users / Leaderboard
    // ========================================

    getOrCreateUser(address: string): UserRow {
        let user = this.db.prepare('SELECT * FROM users WHERE address = ?').get(address) as UserRow | undefined;
        if (!user) {
            this.db.prepare('INSERT INTO users (address) VALUES (?)').run(address);
            user = this.db.prepare('SELECT * FROM users WHERE address = ?').get(address) as UserRow;
        }
        return user;
    }

    updateUserStats(address: string, stats: Partial<UserRow>): void {
        const fields: string[] = [];
        const values: any[] = [];

        if (stats.total_predictions !== undefined) {
            fields.push('total_predictions = ?');
            values.push(stats.total_predictions);
        }
        if (stats.correct_predictions !== undefined) {
            fields.push('correct_predictions = ?');
            values.push(stats.correct_predictions);
        }
        if (stats.win_streak !== undefined) {
            fields.push('win_streak = ?');
            values.push(stats.win_streak);
        }
        if (stats.best_streak !== undefined) {
            fields.push('best_streak = ?');
            values.push(stats.best_streak);
        }
        if (stats.total_profit !== undefined) {
            fields.push('total_profit = ?');
            values.push(stats.total_profit);
        }

        fields.push("updated_at = datetime('now')");
        values.push(address);

        this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE address = ?`).run(...values);
    }

    getLeaderboard(limit: number = 50): UserRow[] {
        return this.db.prepare(`
            SELECT * FROM users
            WHERE total_predictions > 0
            ORDER BY correct_predictions DESC, best_streak DESC
            LIMIT ?
        `).all(limit) as UserRow[];
    }

    // ========================================
    // Lending Positions
    // ========================================

    recordLendingPosition(pos: Partial<LendingPositionRow>): number {
        const stmt = this.db.prepare(`
            INSERT INTO lending_positions (market_id, borrower, yes_collateral, no_collateral, borrowed, interest_owed, tx_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            pos.market_id,
            pos.borrower,
            pos.yes_collateral || '0',
            pos.no_collateral || '0',
            pos.borrowed || '0',
            pos.interest_owed || '0',
            pos.tx_hash || '',
        );
        return result.lastInsertRowid as number;
    }

    getLendingPositionsByMarket(marketId: number): LendingPositionRow[] {
        return this.db.prepare(
            'SELECT * FROM lending_positions WHERE market_id = ? ORDER BY updated_at DESC',
        ).all(marketId) as LendingPositionRow[];
    }

    getLendingPositionsByUser(address: string): LendingPositionRow[] {
        return this.db.prepare(
            'SELECT * FROM lending_positions WHERE borrower = ? ORDER BY updated_at DESC',
        ).all(address) as LendingPositionRow[];
    }

    updateLendingPosition(id: number, data: Partial<LendingPositionRow>): void {
        const fields: string[] = [];
        const values: any[] = [];

        if (data.yes_collateral !== undefined) { fields.push('yes_collateral = ?'); values.push(data.yes_collateral); }
        if (data.no_collateral !== undefined) { fields.push('no_collateral = ?'); values.push(data.no_collateral); }
        if (data.borrowed !== undefined) { fields.push('borrowed = ?'); values.push(data.borrowed); }
        if (data.interest_owed !== undefined) { fields.push('interest_owed = ?'); values.push(data.interest_owed); }
        if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
        if (data.tx_hash !== undefined) { fields.push('tx_hash = ?'); values.push(data.tx_hash); }

        fields.push("updated_at = datetime('now')");
        values.push(id);

        this.db.prepare(`UPDATE lending_positions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    getLendingStats(): { totalPositions: number; activePositions: number; totalBorrowed: string } {
        const total = (this.db.prepare('SELECT COUNT(*) as c FROM lending_positions').get() as any).c;
        const active = (this.db.prepare("SELECT COUNT(*) as c FROM lending_positions WHERE status = 'active'").get() as any).c;
        const borrowed = (this.db.prepare("SELECT COALESCE(SUM(CAST(borrowed AS REAL)), 0) as s FROM lending_positions WHERE status = 'active'").get() as any).s;
        return { totalPositions: total, activePositions: active, totalBorrowed: String(borrowed) };
    }

    // ========================================
    // Stats
    // ========================================

    getStats(): { totalMarkets: number; activeMarkets: number; resolvedMarkets: number; totalTrades: number; totalUsers: number } {
        const totalMarkets = (this.db.prepare('SELECT COUNT(*) as c FROM markets').get() as any).c;
        const activeMarkets = (this.db.prepare("SELECT COUNT(*) as c FROM markets WHERE status = 'active'").get() as any).c;
        const resolvedMarkets = (this.db.prepare("SELECT COUNT(*) as c FROM markets WHERE status = 'resolved'").get() as any).c;
        const totalTrades = (this.db.prepare('SELECT COUNT(*) as c FROM trades').get() as any).c;
        const totalUsers = (this.db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
        return { totalMarkets, activeMarkets, resolvedMarkets, totalTrades, totalUsers };
    }
}

export const databaseService = new DatabaseService();
