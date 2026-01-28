import { MCPClient } from '../server/mcp/oauth-client.js';
import { MultiSessionClient } from '../server/mcp/multi-session-client.js';

export interface CopilotKitAdapterOptions {
    /**
     * Prefix for action names to avoid collision
     * @default serverId or 'mcp'
     */
    prefix?: string;
}

/**
 * Action with handler for server-side MCP tool execution.
 * Parameters kept in JSON Schema format (not CopilotKit frontend format).
 */
export interface CopilotKitAction {
    name: string;
    description: string;
    /** JSON Schema format - for server-side tools, not frontend actions */
    parameters?: Record<string, any>;
    handler?: (args: any) => any | Promise<any>;
}

/**
 * Tool format for passing to remote agents (OpenAI-compatible JSON Schema)
 */
export interface AgentTool {
    name: string;
    description: string;
    parameters: Record<string, any>; // JSON Schema format
}

/**
 * Adapter to use MCP tools within CopilotKit agents.
 *
 * MCP tools are server-side tools - they use JSON Schema format,
 * not CopilotKit's frontend action parameter format.
 *
 * @example
 * ```typescript
 * import { MultiSessionClient } from '@mcp-ts/sdk/server';
 * import { CopilotKitAdapter } from '@mcp-ts/sdk/adapters/copilotkit';
 * import { createMcpToolMiddleware } from '@mcp-ts/sdk/adapters/agui-middleware';
 *
 * const mcpClient = new MultiSessionClient('user_123');
 * await mcpClient.connect();
 *
 * const adapter = new CopilotKitAdapter(mcpClient);
 * const actions = await adapter.getActions();
 * const agentTools = await adapter.getAgentTools();
 *
 * // Use middleware to execute MCP tools server-side
 * agent.use(createMcpToolMiddleware(mcpClient, { actions }));
 * ```
 */
export class CopilotKitAdapter {
    constructor(
        private client: MCPClient | MultiSessionClient,
        private options: CopilotKitAdapterOptions = {}
    ) { }

    /**
     * Get actions with handlers for MCP tool execution.
     * Used by AG-UI middleware to execute tools server-side.
     */
    async getActions(): Promise<CopilotKitAction[]> {
        // Use duck typing instead of instanceof to handle module bundling issues
        const isMultiSession = typeof (this.client as any).getClients === 'function';

        if (isMultiSession) {
            const clients = (this.client as MultiSessionClient).getClients();
            const allActions: CopilotKitAction[] = [];

            for (const client of clients) {
                const actions = await this.transformTools(client);
                allActions.push(...actions);
            }

            return allActions;
        }

        // Handle single MCPClient
        return this.transformTools(this.client as MCPClient);
    }

    private async transformTools(client: MCPClient): Promise<CopilotKitAction[]> {
        if (!client.isConnected()) {
            return [];
        }

        const result = await client.listTools();
        const prefix = this.options.prefix ?? client.getServerId() ?? 'mcp';
        const actions: CopilotKitAction[] = [];

        for (const tool of result.tools) {
            const actionName = `${prefix}_${tool.name}`;

            actions.push({
                name: actionName,
                description: tool.description || `Execute ${tool.name}`,
                parameters: tool.inputSchema || { type: 'object', properties: {} },
                handler: async (args: any) => {
                    console.log(`[CopilotKitAdapter] Executing MCP tool: ${tool.name}`, args);
                    const result = await client.callTool(tool.name, args);

                    // Extract text content from result
                    if (result.content && Array.isArray(result.content)) {
                        const textContent = result.content
                            .filter((c: any) => c.type === 'text')
                            .map((c: any) => c.text)
                            .join('\n');
                        return textContent || result;
                    }

                    return result;
                }
            });
        }

        return actions;
    }

    /**
     * Get actions as a function (for dynamic loading)
     */
    getActionsFunction(): () => Promise<CopilotKitAction[]> {
        return async () => this.getActions();
    }

    /**
     * Get tools in JSON Schema format for passing to remote agents.
     * This format is compatible with OpenAI's function calling API.
     */
    async getAgentTools(): Promise<AgentTool[]> {
        const isMultiSession = typeof (this.client as any).getClients === 'function';

        if (isMultiSession) {
            const clients = (this.client as MultiSessionClient).getClients();
            const allTools: AgentTool[] = [];

            for (const client of clients) {
                const tools = await this.transformToolsForAgent(client);
                allTools.push(...tools);
            }

            return allTools;
        }

        return this.transformToolsForAgent(this.client as MCPClient);
    }

    private async transformToolsForAgent(client: MCPClient): Promise<AgentTool[]> {
        if (!client.isConnected()) {
            return [];
        }

        const result = await client.listTools();
        const prefix = this.options.prefix ?? client.getServerId() ?? 'mcp';
        const tools: AgentTool[] = [];

        for (const tool of result.tools) {
            tools.push({
                name: `${prefix}_${tool.name}`,
                description: tool.description || `Execute ${tool.name}`,
                parameters: tool.inputSchema || { type: 'object', properties: {} },
            });
        }

        return tools;
    }
}
