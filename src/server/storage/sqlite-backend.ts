import type { Database } from 'better-sqlite3';
import { StorageBackend, SessionData } from './types.js'; // Ensure .js extension
import * as fs from 'fs';
import * as path from 'path';

export interface SqliteStorageOptions {
    path?: string;
    table?: string;
}

export class SqliteStorage implements StorageBackend {
    private db: Database | null = null;
    private table: string;
    private initialized = false;
    private dbPath: string;

    constructor(options: SqliteStorageOptions = {}) {
        this.dbPath = options.path || './sessions.db';
        this.table = options.table || 'mcp_sessions';
    }

    async init(): Promise<void> {
        if (this.initialized) return;

        try {
            // Dynamic import for peer dependency
            const DatabaseConstructor = (await import('better-sqlite3')).default;

            // Ensure directory exists
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            this.db = new DatabaseConstructor(this.dbPath);
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS ${this.table} (
                    sessionId TEXT PRIMARY KEY,
                    identity TEXT NOT NULL,
                    data TEXT NOT NULL,
                    expiresAt INTEGER
                );
                CREATE INDEX IF NOT EXISTS idx_${this.table}_identity ON ${this.table}(identity);
            `);

            this.initialized = true;
        } catch (error: any) {
            if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('better-sqlite3')) {
                throw new Error(
                    'better-sqlite3 is not installed. Please install it with: npm install better-sqlite3'
                );
            }
            throw error;
        }
    }

    private ensureInitialized() {
        if (!this.initialized) {
            throw new Error('SqliteStorage not initialized. Call init() first.');
        }
    }

    generateSessionId(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async createSession(session: SessionData, ttl?: number): Promise<void> {
        this.ensureInitialized();
        const { sessionId, identity } = session;

        if (!sessionId || !identity) {
            throw new Error('identity and sessionId required');
        }

        const expiresAt = ttl ? Date.now() + ttl * 1000 : null;

        try {
            const stmt = this.db!.prepare(
                `INSERT INTO ${this.table} (sessionId, identity, data, expiresAt) VALUES (?, ?, ?, ?)`
            );
            stmt.run(sessionId, identity, JSON.stringify(session), expiresAt);
        } catch (error: any) {
            if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
                throw new Error(`Session ${sessionId} already exists`);
            }
            throw error;
        }
    }

    async updateSession(identity: string, sessionId: string, data: Partial<SessionData>, ttl?: number): Promise<void> {
        this.ensureInitialized();
        if (!sessionId || !identity) {
            throw new Error('identity and sessionId required');
        }

        const currentSession = await this.getSession(identity, sessionId);
        if (!currentSession) {
            throw new Error(`Session ${sessionId} not found for identity ${identity}`);
        }

        const updatedSession = { ...currentSession, ...data };
        const expiresAt = ttl ? Date.now() + ttl * 1000 : null;

        const stmt = this.db!.prepare(
            `UPDATE ${this.table} SET data = ?, expiresAt = ? WHERE sessionId = ? AND identity = ?`
        );

        stmt.run(JSON.stringify(updatedSession), expiresAt, sessionId, identity);
    }

    async getSession(identity: string, sessionId: string): Promise<SessionData | null> {
        this.ensureInitialized();

        const stmt = this.db!.prepare(
            `SELECT data FROM ${this.table} WHERE sessionId = ? AND identity = ?`
        );
        const row = stmt.get(sessionId, identity) as { data: string } | undefined;

        if (!row) return null;
        return JSON.parse(row.data) as SessionData;
    }

    async getIdentitySessionsData(identity: string): Promise<SessionData[]> {
        this.ensureInitialized();

        const stmt = this.db!.prepare(
            `SELECT data FROM ${this.table} WHERE identity = ?`
        );
        const rows = stmt.all(identity) as { data: string }[];

        return rows.map(row => JSON.parse(row.data) as SessionData);
    }

    async getIdentityMcpSessions(identity: string): Promise<string[]> {
        this.ensureInitialized();

        const stmt = this.db!.prepare(
            `SELECT sessionId FROM ${this.table} WHERE identity = ?`
        );
        const rows = stmt.all(identity) as { sessionId: string }[];

        return rows.map(row => row.sessionId);
    }

    async removeSession(identity: string, sessionId: string): Promise<void> {
        this.ensureInitialized();
        const stmt = this.db!.prepare(
            `DELETE FROM ${this.table} WHERE sessionId = ? AND identity = ?`
        );
        stmt.run(sessionId, identity);
    }

    async getAllSessionIds(): Promise<string[]> {
        this.ensureInitialized();
        const stmt = this.db!.prepare(`SELECT sessionId FROM ${this.table}`);
        const rows = stmt.all() as { sessionId: string }[];
        return rows.map(row => row.sessionId);
    }

    async clearAll(): Promise<void> {
        this.ensureInitialized();
        const stmt = this.db!.prepare(`DELETE FROM ${this.table}`);
        stmt.run();
    }

    async cleanupExpiredSessions(): Promise<void> {
        this.ensureInitialized();
        const now = Date.now();
        const stmt = this.db!.prepare(
            `DELETE FROM ${this.table} WHERE expiresAt IS NOT NULL AND expiresAt < ?`
        );
        stmt.run(now);
    }

    async disconnect(): Promise<void> {
        if (this.db) {
            this.db.close();
        }
    }
}
