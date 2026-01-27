import { NextRequest } from "next/server";
import {
  CopilotRuntime,
  EmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";
import { AIAdapter } from "@mcp-ts/sdk/adapters/ai";

const serviceAdapter = new EmptyAdapter();

export const POST = async (req: NextRequest) => {

  /**
   * 3️⃣ Create MCP Agent
   */
  const mcpAssistant = new HttpAgent({
    url:
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "http://localhost:8000/agent/agentic_chat", // Point to specific agent endpoint
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

  const mcpTools = await AIAdapter.getTools(manager);

  // Convert MCP tools to CopilotKit Actions
  const mcpActions = Object.entries(mcpTools).map(([name, tool]: [string, any]) => ({
    name,
    description: tool.description,
    parameters: tool.inputSchema,
    handler: async (args: any) => {
      console.log(`[MCP] Executing ${name} with args:`, args);
      if (!tool.execute) {
        throw new Error(`Tool ${name} is not executable`);
      }
      return await tool.execute(args, {
        abortSignal: new AbortController().signal,
        toolCallId: "manual-" + Math.random().toString(36).substring(7),
        messages: []
      });
    }
  }));

  /**
   * 4️⃣ update agentState with mcpConfig
   */
  // mcpAssistant.use((input, next) => {
  //   return next.run({
  //     ...input,
  //     state: {
  //       ...input.state,
  //     },
  //   });
  // });

  /**
   * 5️⃣ Runtime
   */
  const runtime = new CopilotRuntime({
    agents: {
      mcpAssistant,
    },
    // Inject MCP Tools as top-level actions
    actions: mcpActions,
  });

  /**
   * 6️⃣ Endpoint
   */
  const { handleRequest } =
    copilotRuntimeNextJSAppRouterEndpoint({
      runtime,
      serviceAdapter,
      endpoint: "/api/copilotkit",
    });

  return handleRequest(req);
};