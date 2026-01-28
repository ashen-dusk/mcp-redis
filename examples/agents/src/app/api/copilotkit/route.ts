import { NextRequest } from "next/server";
import {
  CopilotRuntime,
  EmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";
import { CopilotKitAdapter } from "@mcp-ts/sdk/adapters/copilotkit";
import { createMcpToolMiddleware } from "@mcp-ts/sdk/adapters/agui-middleware";

const serviceAdapter = new EmptyAdapter();

export const POST = async (req: NextRequest) => {

  /**
   * 3️⃣ Create MCP Agent
   */
  const mcpAssistant = new HttpAgent({
    url:
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "http://127.0.0.1:8000/agent", // Point to specific agent endpoint
      headers: {
      "Content-Type": "application/json",
    },
  });

  const identity = "demo-user-123";
  // Import dynamically to avoid build-time issues if package is linking
  const { MultiSessionClient } = await import("@mcp-ts/sdk/server");
  const manager = new MultiSessionClient(identity);

  // Connect to all active sessions before getting tools
  await manager.connect();

  // Log number of connected clients for debugging
  const clients = manager.getClients();
  console.log(`[CopilotKit] Connected to ${clients.length} MCP clients`);

  const adapter = new CopilotKitAdapter(manager);

  // Get tools in JSON Schema format for passing to the Python agent (OpenAI-compatible)
  const agentTools = await adapter.getAgentTools();
  // Pre-load actions for the middleware to use
  const mcpActions = await adapter.getActions();

  console.log(`[CopilotKit] Loaded ${agentTools.length} MCP tools for CopilotKit agent.`);

  /**
   * 4️Add MCP Tool Execution Middleware
   * This middleware intercepts MCP tool calls (server-*) and executes them server-side
   */
  mcpAssistant.use(createMcpToolMiddleware(manager, {
    toolPrefix: 'server-',
    actions: mcpActions,
  }));
 
  /**
   * 6️⃣ Runtime
   */
  const runtime = new CopilotRuntime({
    agents: {
      mcpAssistant,
    },
  });

  /**
   * 7️⃣ Endpoint
   */
  const { handleRequest } =
    copilotRuntimeNextJSAppRouterEndpoint({
      runtime,
      serviceAdapter,
      endpoint: "/api/copilotkit",
    });

  return handleRequest(req);
};
