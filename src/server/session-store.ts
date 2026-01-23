import type { MCPClient } from './oauth-client';
import { Redis } from 'ioredis';
import type {
  OAuthTokens,
  OAuthClientInformationMixed,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { customAlphabet } from 'nanoid';
import { redis } from './redis';

export interface SessionData {
  sessionId: string;
  serverId?: string; // Database server ID for mapping
  serverName?: string;
  serverUrl: string;
  callbackUrl: string;
  transportType: 'sse' | 'streamable_http';
  createdAt: number;
  active: boolean;
  identity?: string;
  headers?: Record<string, string>;
  // OAuth data (consolidated)
  clientInformation?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  codeVerifier?: string;
  clientId?: string;
}

export interface SetClientOptions {
  sessionId: string;
  serverId?: string; // Database server ID
  serverName?: string; // Human-readable server name
  client?: MCPClient;
  serverUrl?: string;
  callbackUrl?: string;
  transportType?: 'sse' | 'streamable_http';
  identity?: string;
  headers?: Record<string, string>;
  active?: boolean;
}

// first char: letters only (required by OpenAI)
const firstChar = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  1
);

// remaining chars: alphanumeric
const rest = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  11
);

/**
 * Manages MCP session data in Redis with automatic TTL management
 * Sessions are keyed by identity:sessionId and have a 12-hour TTL
 */
export class SessionStore {
  private readonly SESSION_TTL = 43200;
  private readonly KEY_PREFIX = 'mcp:session:';

  constructor(private redis: Redis) { }

  /**
   * Generates Redis key for a specific session
   * @param identity - User/Client identifier
   * @param sessionId - Session identifier
   * @returns Redis key in format mcp:session:identity:sessionId
   * @private
   */
  private getSessionKey(identity: string, sessionId: string): string {
    return `${this.KEY_PREFIX}${identity}:${sessionId}`;
  }

  /**
   * Generates Redis key for tracking all sessions for an identity
   * @param identity - User/Client identifier
   * @returns Redis key for identity's session set
   * @private
   */
  private getIdentityKey(identity: string): string {
    return `mcp:identity:${identity}:sessions`;
  }

  /**
   * Generates a unique session ID starting with a letter (OpenAI compatible)
   * @returns Random session ID string
   */
  generateSessionId(): string {
    return firstChar() + rest();
  }

  /**
   * Stores or updates a session in Redis with 12-hour TTL
   * Preserves existing OAuth data (tokens, client info) when updating
   * @param options - Session configuration options
   * @throws {Error} When required fields (serverUrl, callbackUrl, identity, sessionId) are missing
   */
  async setClient(options: SetClientOptions): Promise<void> {
    const {
      sessionId,
      serverId,
      serverName,
      serverUrl,
      callbackUrl,
      transportType = 'streamable_http',
      identity,
      headers,
      active = false
    } = options;

    if (!serverUrl || !callbackUrl) {
      throw new Error('serverUrl and callbackUrl required');
    }

    if (!identity || !sessionId) {
      throw new Error('identity and sessionId required');
    }

    try {
      const sessionKey = this.getSessionKey(identity, sessionId);
      const existingDataStr = await this.redis.get(sessionKey);
      const existingData = existingDataStr ? JSON.parse(existingDataStr) : {};

      const sessionData: SessionData = {
        ...existingData,
        sessionId,
        serverId,
        serverName,
        serverUrl,
        callbackUrl,
        transportType,
        createdAt: existingData.createdAt || Date.now(),
        active,
        identity,
        headers,
      };

      await this.redis.setex(sessionKey, this.SESSION_TTL, JSON.stringify(sessionData));

      const identityKey = this.getIdentityKey(identity);
      await this.redis.sadd(identityKey, sessionId);
    } catch (error) {
      console.error('[SessionStore] Failed to store session:', error);
      throw error;
    }
  }

  /**
   * Retrieves a session from Redis and refreshes its TTL
   * @param identity - User/Client identifier
   * @param sessionId - Session identifier
   * @returns Session data or null if not found
   */
  async getSession(identity: string, sessionId: string): Promise<SessionData | null> {
    try {
      const sessionKey = this.getSessionKey(identity, sessionId);
      const sessionDataStr = await this.redis.get(sessionKey);

      if (!sessionDataStr) {
        return null;
      }

      const sessionData: SessionData = JSON.parse(sessionDataStr);
      await this.redis.expire(sessionKey, this.SESSION_TTL);
      return sessionData;
    } catch (error) {
      console.error('[SessionStore] Failed to get session:', error);
      return null;
    }
  }

  /**
   * Gets all session IDs for a specific identity
   * @param identity - User/Client identifier
   * @returns Array of session IDs
   */
  async getIdentityMcpSessions(identity: string): Promise<string[]> {
    const identityKey = this.getIdentityKey(identity);
    try {
      return await this.redis.smembers(identityKey);
    } catch (error) {
      console.error(`[SessionStore] Failed to get sessions for ${identity}:`, error);
      return [];
    }
  }

  /**
   * Gets full session data for all of an identity's sessions
   * Filters out null/invalid sessions automatically
   * @param identity - User/Client identifier
   * @returns Array of session data objects
   */
  async getIdentitySessionsData(identity: string): Promise<SessionData[]> {
    try {
      const sessionIds = await this.redis.smembers(this.getIdentityKey(identity));
      if (sessionIds.length === 0) return [];

      const results = await Promise.all(
        sessionIds.map(async (sessionId) => {
          const data = await this.redis.get(this.getSessionKey(identity, sessionId));
          return data ? (JSON.parse(data) as SessionData) : null;
        })
      );

      return results.filter((session): session is SessionData => session !== null);
    } catch (error) {
      console.error(`[SessionStore] Failed to get session data for ${identity}:`, error);
      return [];
    }
  }

  /**
   * Removes a session from Redis
   * Cleans up both the session data and identity's session tracking
   * @param identity - User/Client identifier
   * @param sessionId - Session identifier
   */
  async removeSession(identity: string, sessionId: string): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(identity, sessionId);
      const identityKey = this.getIdentityKey(identity);

      await this.redis.srem(identityKey, sessionId);
      await this.redis.del(sessionKey);
    } catch (error) {
      console.error('[SessionStore] Failed to remove session:', error);
    }
  }

  /**
   * Gets all session IDs across all identities
   * Warning: Can be expensive with many sessions
   * @returns Array of all session IDs
   */
  async getAllSessionIds(): Promise<string[]> {
    try {
      const pattern = `${this.KEY_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      return keys.map((key) => key.replace(this.KEY_PREFIX, ''));
    } catch (error) {
      console.error('[SessionStore] Failed to get all sessions:', error);
      return [];
    }
  }

  /**
   * Removes all sessions from Redis
   * Warning: Use with caution - deletes all identity sessions
   */
  async clearAll(): Promise<void> {
    try {
      const pattern = `${this.KEY_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('[SessionStore] Failed to clear sessions:', error);
    }
  }

  /**
   * Manually removes expired sessions from Redis
   * Note: Redis TTL handles this automatically, but can be useful for cleanup
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const pattern = `${this.KEY_PREFIX}*`;
      const keys = await this.redis.keys(pattern);

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl <= 0) {
          await this.redis.del(key);
        }
      }
    } catch (error) {
      console.error('[SessionStore] Failed to cleanup expired sessions:', error);
    }
  }

  /**
   * Closes the Redis connection
   * Should be called when shutting down the application
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      console.error('[SessionStore] Failed to disconnect:', error);
    }
  }
}

export const sessionStore = new SessionStore(redis);
