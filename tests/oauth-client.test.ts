import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPClient } from '../src/server/oauth-client';
import { storage } from '../src/server/storage';
import { StorageOAuthClientProvider } from '../src/server/storage-oauth-provider';

// Mock storage
vi.mock('../src/server/storage', () => ({
    storage: {
        getIdentitySessionsData: vi.fn(),
        removeSession: vi.fn(),
    },
}));

// Mock StorageOAuthClientProvider
vi.mock('../src/server/storage-oauth-provider', () => ({
    StorageOAuthClientProvider: vi.fn().mockImplementation(() => ({
        tokens: vi.fn().mockResolvedValue({ access_token: 'mock-access-token' }),
    })),
}));

describe('MCPClient.getMcpServerConfig', () => {
    const identity = 'test-user';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should process multiple sessions in parallel and return the correct config', async () => {
        // Spy on MCPClient prototype methods
        const initSpy = vi.spyOn(MCPClient.prototype, 'initialize').mockResolvedValue(undefined);
        const getTokensSpy = vi.spyOn(MCPClient.prototype, 'getValidTokens').mockResolvedValue(true);

        const session1 = {
            sessionId: 's1',
            active: true,
            serverId: 'server1',
            serverName: 'Server One',
            serverUrl: 'http://server1',
            transportType: 'sse' as const,
            callbackUrl: 'http://callback1',
        };
        const session2 = {
            sessionId: 's2',
            active: true,
            serverId: 'server2',
            serverName: 'Server Two',
            serverUrl: 'http://server2',
            transportType: 'streamable_http' as const,
            callbackUrl: 'http://callback2',
        };

        vi.mocked(storage.getIdentitySessionsData).mockResolvedValue([session1, session2] as any);

        const config = await MCPClient.getMcpServerConfig(identity);

        expect(storage.getIdentitySessionsData).toHaveBeenCalledWith(identity);
        expect(initSpy).toHaveBeenCalledTimes(2);
        expect(getTokensSpy).toHaveBeenCalledTimes(2);

        expect(config).toEqual({
            'server_one': expect.objectContaining({
                transport: 'sse',
                url: 'http://server1',
            }),
            'server_two': expect.objectContaining({
                transport: 'streamable_http',
                url: 'http://server2',
            }),
        });

        initSpy.mockRestore();
        getTokensSpy.mockRestore();
    });

    it('should remove inactive sessions', async () => {
        const session1 = {
            sessionId: 's1',
            active: false,
            serverId: 'server1',
            serverUrl: 'http://server1',
            callbackUrl: 'http://callback1',
        };

        vi.mocked(storage.getIdentitySessionsData).mockResolvedValue([session1] as any);

        const config = await MCPClient.getMcpServerConfig(identity);

        expect(storage.removeSession).toHaveBeenCalledWith(identity, 's1');
        expect(config).toEqual({});
    });
});
