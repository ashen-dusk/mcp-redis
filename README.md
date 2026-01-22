# @mcp-assistant/mcp-redis

Redis-backed MCP (Model Context Protocol) client with OAuth 2.0 and real-time SSE connections for serverless environments.

[![npm version](https://badge.fury.io/js/@mcp-assistant%2Fmcp-redis.svg)](https://www.npmjs.com/package/@mcp-assistant/mcp-redis)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **🔄 Real-Time SSE**: Server-Sent Events for live connection updates (no WebSockets needed)
- **🔐 OAuth 2.0**: Full OAuth support with automatic token refresh
- **📦 Redis-Backed**: Stateless session management with 12-hour TTL
- **⚡ Serverless-Ready**: Works in serverless environments (Vercel, AWS Lambda, etc.)
- **⚛️ React Hook**: `useMcp` hook for easy React integration
- **🎯 Observable State**: Cloudflare agents-inspired event system
- **📘 TypeScript**: Full type safety with exported types
- **🚀 Dual Exports**: Separate server and client packages

## Installation

```bash
npm install @mcp-assistant/mcp-redis
# or
yarn add @mcp-assistant/mcp-redis
# or
pnpm add @mcp-assistant/mcp-redis
```

## Quick Start

### Server-Side: Create SSE Endpoint

```typescript
import { createSSEHandler } from '@mcp-assistant/mcp-redis/server';
import { createServer } from 'http';

// Create SSE handler for real-time MCP connections
const handler = createSSEHandler({
  userId: 'user-123', // Get from authentication
  heartbeatInterval: 30000, // Optional: 30s heartbeat
});

// Start server
createServer(handler).listen(3000);
console.log('SSE endpoint running on http://localhost:3000');
```

### Client-Side: React Hook

```typescript
import { useMcp } from '@mcp-assistant/mcp-redis/client';

function MyComponent() {
  const {
    connections,
    status,
    connect,
    disconnect,
    isInitializing,
  } = useMcp({
    url: '/api/mcp/sse',
    userId: 'user-123',
    authToken: 'your-auth-token', // Optional
    autoConnect: true,
    autoInitialize: true,
  });

  const handleConnect = async () => {
    const sessionId = await connect({
      serverId: 'my-server-id',
      serverName: 'My MCP Server',
      serverUrl: 'https://mcp.example.com',
      callbackUrl: window.location.origin + '/oauth/callback',
      transportType: 'sse',
    });
    console.log('Connected with session:', sessionId);
  };

  return (
    <div>
      <h2>MCP Connections</h2>
      <p>SSE Status: {status}</p>
      <button onClick={handleConnect}>Connect to Server</button>

      {isInitializing && <p>Loading sessions...</p>}

      {connections.map((conn) => (
        <div key={conn.sessionId}>
          <h3>{conn.serverName}</h3>
          <p>State: {conn.state}</p>
          <p>Tools: {conn.tools.length}</p>
          {conn.state === 'CONNECTED' && (
            <button onClick={() => disconnect(conn.sessionId)}>
              Disconnect
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Architecture

### SSE-Based Real-Time Communication

Unlike WebSocket-based systems, this package uses **Server-Sent Events (SSE)**:

```
┌─────────┐                    ┌──────────┐
│ Browser │◄───SSE Events──────│  Server  │
│         │                    │          │
│         ├────HTTP POST───────►│  (Node)  │
└─────────┘   (RPC calls)      └──────────┘
```

**Benefits:**
- Works behind most corporate firewalls
- Serverless-friendly (no persistent connections in memory)
- Built-in reconnection in browsers
- Simpler than WebSockets

### Package Structure

```
@mcp-assistant/mcp-redis
├── /server       # Node.js server-side
│   ├── MCPClient
│   ├── SessionStore
│   ├── createSSEHandler
│   └── OAuth providers
├── /client       # Browser/React client
│   ├── SSEClient
│   └── useMcp (React hook)
└── /shared       # Common types/utils
    ├── Events
    ├── Types
    └── Utils
```

## Usage

### Server-Side API

#### Creating an SSE Endpoint

**Next.js API Route** (`pages/api/mcp/sse.ts`):
```typescript
import { createSSEHandler } from '@mcp-assistant/mcp-redis/server';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.query.userId as string; // Get from auth

  const sseHandler = createSSEHandler({
    userId,
    onAuth: async (uid) => {
      // Optional: Verify user authorization
      return uid === userId;
    },
  });

  return sseHandler(req, res);
}
```

**Express Server**:
```typescript
import express from 'express';
import { createSSEHandler } from '@mcp-assistant/mcp-redis/server';

const app = express();

app.get('/mcp/sse', (req, res) => {
  const userId = req.user.id; // Get from auth middleware

  const handler = createSSEHandler({ userId });
  handler(req, res);
});

app.listen(3000);
```

#### Using MCPClient Directly

```typescript
import { MCPClient, sessionStore } from '@mcp-assistant/mcp-redis/server';

// Generate session ID
const sessionId = sessionStore.generateSessionId();

// Create client
const client = new MCPClient({
  userId: 'user-123',
  sessionId,
  serverUrl: 'https://mcp.example.com',
  callbackUrl: 'http://localhost:3000/oauth/callback',
  transportType: 'sse',
  onRedirect: (authUrl) => {
    console.log('Redirect user to:', authUrl);
  },
});

// Connect (may throw UnauthorizedError if OAuth needed)
try {
  await client.connect();
  console.log('Connected successfully');

  // List tools
  const tools = await client.listTools();
  console.log('Available tools:', tools.tools);

  // Call a tool
  const result = await client.callTool('tool_name', {
    arg1: 'value',
  });
  console.log('Tool result:', result);
} catch (error) {
  if (error instanceof UnauthorizedError) {
    // Handle OAuth redirect
  }
}
```

#### OAuth Callback Handler

```typescript
import { MCPClient } from '@mcp-assistant/mcp-redis/server';

export async function handleOAuthCallback(code: string, state: string) {
  // state contains sessionId and other metadata
  const { sessionId, serverId } = JSON.parse(state);

  const client = new MCPClient({
    userId: 'user-123',
    sessionId,
    serverId,
  });

  // Exchange code for tokens
  await client.finishAuth(code);

  // Now connected and tokens are saved in Redis
  const tools = await client.listTools();
  return tools;
}
```

### Client-Side API

#### useMcp Hook

```typescript
import { useMcp } from '@mcp-assistant/mcp-redis/client';

const {
  // State
  connections,      // Array of all connections
  status,          // SSE connection status
  isInitializing,  // Loading initial sessions

  // Actions
  connect,         // Connect to a new MCP server
  disconnect,      // Disconnect from a server
  refresh,         // Reload all sessions
  connectSSE,      // Manually connect SSE
  disconnectSSE,   // Manually disconnect SSE

  // Utilities
  getConnection,         // Get connection by sessionId
  getConnectionByServerId, // Get connection by serverId
  isServerConnected,    // Check if server is connected
  getTools,            // Get tools for a session
} = useMcp({
  url: '/api/mcp/sse',
  userId: 'user-123',
  authToken: 'optional-token',
  autoConnect: true,      // Auto-connect SSE on mount
  autoInitialize: true,   // Auto-load sessions on mount
  onConnectionEvent: (event) => {
    // Handle connection events
    console.log('Connection event:', event);
  },
  onLog: (level, message, metadata) => {
    // Handle debug logs
    console.log(`[${level}] ${message}`, metadata);
  },
});
```

#### SSEClient (Lower-Level)

```typescript
import { SSEClient } from '@mcp-assistant/mcp-redis/client';

const client = new SSEClient({
  url: '/api/mcp/sse',
  userId: 'user-123',
  onConnectionEvent: (event) => {
    switch (event.type) {
      case 'state_changed':
        console.log('State:', event.state);
        break;
      case 'tools_discovered':
        console.log('Tools:', event.tools);
        break;
      case 'auth_required':
        window.location.href = event.authUrl;
        break;
    }
  },
  onStatusChange: (status) => {
    console.log('SSE Status:', status);
  },
});

// Connect to SSE endpoint
client.connect();

// Get all sessions
const sessions = await client.getSessions();

// Connect to a server
const result = await client.connectToServer({
  serverId: 'server-id',
  serverName: 'My Server',
  serverUrl: 'https://mcp.example.com',
  callbackUrl: window.location.origin + '/oauth/callback',
});

// List tools
const tools = await client.listTools(sessionId);

// Call a tool
const toolResult = await client.callTool(sessionId, 'tool_name', {
  arg1: 'value',
});

// Disconnect
await client.disconnectFromServer(sessionId);

// Close SSE connection
client.disconnect();
```

## Connection States

Connections progress through the following states:

```typescript
type McpConnectionState =
  | 'DISCONNECTED'      // Not connected
  | 'CONNECTING'        // Initial connection attempt
  | 'AUTHENTICATING'    // OAuth flow in progress
  | 'AUTHENTICATED'     // OAuth complete
  | 'DISCOVERING'       // Fetching tools
  | 'CONNECTED'         // Fully connected with tools
  | 'VALIDATING'        // Validating existing session
  | 'RECONNECTING'      // Attempting reconnect
  | 'FAILED';           // Connection error
```

## Events

The system emits various events for observability:

```typescript
type McpConnectionEvent =
  | { type: 'state_changed'; sessionId: string; state: McpConnectionState; ... }
  | { type: 'tools_discovered'; sessionId: string; tools: Tool[]; ... }
  | { type: 'auth_required'; sessionId: string; authUrl: string; ... }
  | { type: 'error'; sessionId: string; error: string; ... }
  | { type: 'disconnected'; sessionId: string; reason?: string; ... }
  | { type: 'progress'; sessionId: string; message: string; ... };
```

## Configuration

### Environment Variables

```bash
# Redis connection
REDIS_URL=redis://localhost:6379/0

# Optional: Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_DB=0
```

### Redis Schema

Sessions are stored with the following structure:

**Key**: `mcp:session:{sessionId}`
**TTL**: 43200 seconds (12 hours)
**Value**:
```json
{
  "sessionId": "abc123",
  "userId": "user-123",
  "serverId": "server-xyz",
  "serverName": "Example Server",
  "serverUrl": "https://mcp.example.com",
  "callbackUrl": "http://localhost:3000/callback",
  "transportType": "sse",
  "active": true,
  "tokens": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_in": 3600
  },
  "clientInformation": { ... }
}
```

**User Index**: `mcp:user:{userId}:sessions` (set of sessionIds)

## TypeScript Support

The package is fully typed. Import types as needed:

```typescript
// Connection events and states
import type {
  McpConnectionEvent,
  McpConnectionState,
  McpObservabilityEvent,
} from '@mcp-assistant/mcp-redis/shared';

// Tool information
import type { ToolInfo } from '@mcp-assistant/mcp-redis/shared';

// RPC types
import type {
  McpRpcRequest,
  McpRpcResponse,
} from '@mcp-assistant/mcp-redis/shared';

// OAuth types (from MCP SDK)
import type {
  OAuthTokens,
  OAuthClientInformation,
} from '@mcp-assistant/mcp-redis/server';
```

## Examples

### Next.js Full Integration

```typescript
// app/api/mcp/sse/route.ts
import { createSSEHandler } from '@mcp-assistant/mcp-redis/server';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');

  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const handler = createSSEHandler({ userId });

  // Convert Next.js Request to Node.js request
  return new Response(
    new ReadableStream({
      start(controller) {
        const write = (data: string) => {
          controller.enqueue(new TextEncoder().encode(data));
        };

        const mockRes = {
          writeHead: () => {},
          write,
          end: () => controller.close(),
        };

        handler(req as any, mockRes as any);
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Handle RPC requests
  // ... (forward to same SSE handler)
}
```

```typescript
// app/components/McpConnections.tsx
'use client';

import { useMcp } from '@mcp-assistant/mcp-redis/client';

export function McpConnections({ userId }: { userId: string }) {
  const { connections, connect, disconnect, status } = useMcp({
    url: `/api/mcp/sse?userId=${userId}`,
    userId,
  });

  return (
    <div>
      <h2>MCP Connections ({status})</h2>
      {connections.map((conn) => (
        <div key={conn.sessionId}>
          <h3>{conn.serverName}</h3>
          <p>State: {conn.state}</p>
          <p>Tools: {conn.tools.length}</p>
        </div>
      ))}
    </div>
  );
}
```

## Error Handling

```typescript
import { UnauthorizedError } from '@mcp-assistant/mcp-redis/server';

try {
  await client.connect();
} catch (error) {
  if (error instanceof UnauthorizedError) {
    // Redirect to OAuth
    window.location.href = error.authUrl;
  } else if (error.message === 'Session not found') {
    // Session expired
    console.error('Session expired, please reconnect');
  } else {
    // Other errors
    console.error('Connection failed:', error);
  }
}
```

## Best Practices

1. **Always handle OAuth redirects**: Listen for `auth_required` events
2. **Validate sessions on load**: Use `refreshSession` to validate stored sessions
3. **Handle SSE reconnection**: Show UI feedback during reconnection
4. **Use error boundaries**: Wrap SSE connections in React error boundaries
5. **Clean up on unmount**: The `useMcp` hook handles this automatically
6. **Monitor heartbeats**: Set appropriate heartbeat intervals for your use case

## Troubleshooting

### Redis Connection Issues
- Ensure Redis is running: `redis-cli ping`
- Check `REDIS_URL` environment variable
- Verify network connectivity

### SSE Not Connecting
- Check browser console for CORS errors
- Verify endpoint URL is correct
- Ensure auth token is passed if required

### OAuth Flow Broken
- Check callback URL matches server configuration
- Verify state parameter is preserved
- Ensure session exists in Redis during callback

## Contributing

Contributions are welcome! Please read CLAUDE.md for development guidelines.

## License

MIT © MCP Assistant Contributors

## Attribution

This library was developed with assistance from Claude (Anthropic's AI assistant). The architecture was inspired by:
- [Cloudflare's agents pattern](https://github.com/cloudflare/agents) - Observable state management
- [MCP SDK](https://github.com/modelcontextprotocol/sdk) - OAuth 2.0 flows and protocol implementation
- Modern npm packaging best practices - Dual ESM/CJS exports with proper TypeScript support

## Links

- [npm Package](https://www.npmjs.com/package/@mcp-assistant/mcp-redis)
- [GitHub Repository](https://github.com/yourusername/mcp-redis)
- [Issues](https://github.com/yourusername/mcp-redis/issues)
- [MCP Protocol](https://modelcontextprotocol.io)
