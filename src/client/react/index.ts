/**
 * MCP SDK - React Client
 * Simple React hooks for MCP app rendering
 */

// Core MCP Hook
export { useMcp, type UseMcpOptions, type McpClient, type McpConnection } from './use-mcp.js';

// App Host (internal use)
export { useAppHost } from './use-app-host.js';

// Simplified MCP Apps Hook - the main API
export { useMcpApps } from './use-mcp-apps.js';

// Re-export shared types and client from main entry
export * from '../index.js';
