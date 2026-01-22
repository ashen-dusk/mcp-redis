/**
 * MCP Redis Shared Package
 * Shared types and utilities for both server and client
 */

// Events
export {
  Emitter,
  DisposableStore,
  type Disposable,
  type Event,
  type McpConnectionState,
  type McpConnectionEvent,
  type McpObservabilityEvent,
} from './events';

// Types
export type {
  ToolInfo,
  McpRpcRequest,
  McpRpcResponse,
  ConnectRequest,
  ConnectResponse,
  ConnectSuccessResponse,
  ConnectAuthRequiredResponse,
  ConnectErrorResponse,
  ListToolsResponse,
  CallToolRequest,
  CallToolResponse,
 } from './types';

export {
  isConnectSuccess,
  isConnectAuthRequired,
  isConnectError,
  isListToolsSuccess,
  isCallToolSuccess,
} from './types';
