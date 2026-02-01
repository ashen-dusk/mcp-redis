"use client";

import { createContext, useContext, ReactNode } from 'react';
import { useMcp, type McpClient } from '@mcp-ts/sdk/client/react';
import type { SSEClient } from '@mcp-ts/sdk/client';

interface McpContextValue {
    client: SSEClient | null;
    mcpClient: McpClient;
}

const McpContext = createContext<McpContextValue | null>(null);

interface McpProviderProps {
    children: ReactNode;
    url: string;
    identity: string;
}

/**
 * MCP Provider - Shares a single MCP client instance across the app
 * Prevents duplicate SSE connections and request timeouts
 */
export function McpProvider({ children, url, identity }: McpProviderProps) {
    const mcp = useMcp({ url, identity });

    return (
        <McpContext.Provider value={{ client: mcp.client, mcpClient: mcp }}>
            {children}
        </McpContext.Provider>
    );
}

/**
 * Hook to access the shared MCP client
 * Must be used within McpProvider
 */
export function useMcpContext(): McpContextValue {
    const context = useContext(McpContext);
    if (!context) {
        throw new Error('useMcpContext must be used within McpProvider');
    }
    return context;
}
