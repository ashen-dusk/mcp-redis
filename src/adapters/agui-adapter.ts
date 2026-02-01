/**
 * MCP Adapter for AG-UI Integration
 *
 * This adapter transforms MCP tools into formats compatible with AG-UI agents.
 * It provides tools with handlers for server-side execution and tool definitions
 * in JSON Schema format for passing to remote agents.
 *
 * @example
 * ```typescript
 * import { MultiSessionClient } from '@mcp-ts/sdk/server';
 * import { AguiAdapter } from '@mcp-ts/sdk/adapters/agui-adapter';
 * import { createMcpMiddleware } from '@mcp-ts/sdk/adapters/agui-middleware';
 * import { HttpAgent } from '@ag-ui/client';
 *
 * // Create MCP client
 * const mcpClient = new MultiSessionClient('user_123');
 * await mcpClient.connect();
 *
 * // Create adapter and get tools
 * const adapter = new AguiAdapter(mcpClient);
 * const tools = await adapter.getTools();
 *
 * // Use with AG-UI middleware
 * const agent = new HttpAgent({ url: 'http://localhost:8000/agent' });
 * agent.use(createMcpMiddleware({ tools }));
 * ```
 */

import { MCPClient } from '../server/mcp/oauth-client.js';
import { MultiSessionClient } from '../server/mcp/multi-session-client.js';

/**
 * Cleans a JSON Schema by removing meta-properties that cause issues with
 * strict Pydantic validation (e.g., Google ADK).
 *
 * Removes: $schema, $id, $comment, $defs, definitions
 *
 * @param schema - The JSON Schema to clean
 * @returns Cleaned schema without meta-properties
 */
export function cleanSchema(schema: Record<string, any> | undefined): Record<string, any> {
    if (!schema) {
        return { type: 'object', properties: {} };
    }

    const cleaned = { ...schema };

    // Remove JSON Schema meta-properties that cause Pydantic validation errors
    delete cleaned.$schema;
    delete cleaned.$id;
    delete cleaned.$comment;
    delete cleaned.$defs;
    delete cleaned.definitions;

    // Recursively clean nested properties
    if (cleaned.properties && typeof cleaned.properties === 'object') {
        const cleanedProps: Record<string, any> = {};
        for (const [key, value] of Object.entries(cleaned.properties)) {
            if (typeof value === 'object' && value !== null) {
                cleanedProps[key] = cleanSchema(value as Record<string, any>);
            } else {
                cleanedProps[key] = value;
            }
        }
        cleaned.properties = cleanedProps;
    }

    // Clean items if it's an array schema
    if (cleaned.items && typeof cleaned.items === 'object') {
        cleaned.items = cleanSchema(cleaned.items);
    }

    // Clean additionalProperties if it's an object schema
    if (cleaned.additionalProperties && typeof cleaned.additionalProperties === 'object') {
        cleaned.additionalProperties = cleanSchema(cleaned.additionalProperties);
    }

    return cleaned;
}

/**
 * Configuration options for AguiAdapter
 */
export interface AguiAdapterOptions {
    /**
     * Prefix for tool names to avoid collision with other tools.
     * @default serverId or 'mcp'
     */
    prefix?: string;
}

/**
 * AG-UI Tool with handler for server-side execution.
 */
export interface AguiTool {
    name: string;
    description: string;
    parameters?: Record<string, any>;
    _meta?: Record<string, any>; // Add _meta to AguiTool
    handler?: (args: any) => any | Promise<any>;
}

/**
 * Tool definition format for passing to remote agents (without handler).
 */
export interface AguiToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, any>;
    _meta?: Record<string, any>; // Add _meta to AguiToolDefinition
}

/**
 * Adapter that transforms MCP tools into AG-UI compatible formats.
 */
export class AguiAdapter {
    constructor(
        private client: MCPClient | MultiSessionClient,
        private options: AguiAdapterOptions = {}
    ) { }

    /**
     * Get tools with handlers for MCP tool execution.
     */
    async getTools(): Promise<AguiTool[]> {
        if (this.isMultiSession()) {
            const clients = (this.client as MultiSessionClient).getClients();
            const allTools: AguiTool[] = [];
            for (const client of clients) {
                allTools.push(...await this.transformTools(client));
            }
            return allTools;
        }
        return this.transformTools(this.client as MCPClient);
    }

    /**
     * Get tool definitions in JSON Schema format for passing to remote agents.
     */
    async getToolDefinitions(): Promise<AguiToolDefinition[]> {
        if (this.isMultiSession()) {
            const clients = (this.client as MultiSessionClient).getClients();
            const allTools: AguiToolDefinition[] = [];
            for (const client of clients) {
                allTools.push(...await this.transformToolDefinitions(client));
            }
            return allTools;
        }
        return this.transformToolDefinitions(this.client as MCPClient);
    }

    /**
     * Get tools as a function (for dynamic loading).
     */
    getToolsFunction(): () => Promise<AguiTool[]> {
        return () => this.getTools();
    }

    private isMultiSession(): boolean {
        return typeof (this.client as any).getClients === 'function';
    }

    private async transformTools(client: MCPClient): Promise<AguiTool[]> {
        if (!client.isConnected()) return [];

        const result = await client.listTools();
        const prefix = this.options.prefix ?? `tool_${client.getServerId() ?? 'mcp'}`;

        return result.tools.map(tool => {
            // Type assertion to access _meta if it exists on the tool object (it comes from MCP SDK)
            const mcpTool = tool as any;
            return {
                name: `${prefix}_${tool.name}`,
                description: tool.description || `Execute ${tool.name}`,
                parameters: cleanSchema(tool.inputSchema),
                _meta: mcpTool._meta,
                handler: async (args: any) => {
                    console.log(`[AguiAdapter] Executing MCP tool: ${tool.name}`, args);

                    // If the tool has UI metadata, we want to capture that in the result too ideally
                    // But generally callTool returns CallToolResult which has 'content' and 'isError'
                    const result = await client.callTool(tool.name, args);

                    // If _meta exists, we might need to signify this to the caller (middleware)
                    // The middleware typically stringifies the result. 
                    // If we want to support MCP Apps, we should return the full result object including content
                    // IF the middleware can handle objects.

                    // For backward compatibility with simpler agents, we prefer text. 
                    // BUT if it's an App tool, we MUST preserve structure if the middleware is to do anything with it.
                    // However, the standard Adapter contract often expects a string return or simple JSON.

                    // If the result has _meta (from the tool call itself? No, _meta is on the tool definition)
                    // but the RESULT of the tool call might trigger the UI.
                    // Actually the MCP Apps doc says: "When the host calls this tool, the UI is fetched and rendered, and the tool result is passed to it upon arrival."
                    // So the tool definition's _meta tells the host "Hey, I have a UI".

                    // So here we just need to return the result content. 
                    // The Middleware needs to know about the tool's _meta to attach it to the result event?
                    // Or the Agent client (Ag-UI) needs to see _meta in the tool definition.

                    if (result.content && Array.isArray(result.content)) {
                        // We return the raw content array so the middleware can decide how to format it
                        // or if we must return a string:
                        const textContent = result.content
                            .filter((c: any) => c.type === 'text')
                            .map((c: any) => c.text)
                            .join('\n');

                        // If there are other types (images, resources), we might be losing them if we just return text.
                        // But for now let's stick to text for the main return, unless we change the Middleware to handle objects.
                        // IMPORTANT: The AguiMiddleware.executeTool currently handles string | object.
                        // implementation of executeTool: let resultStr = typeof result === 'string' ? result : JSON.stringify(result);

                        // So we can return the whole result object!
                        return result;
                    }
                    return result;
                }
            }
        });
    }

    private async transformToolDefinitions(client: MCPClient): Promise<AguiToolDefinition[]> {
        if (!client.isConnected()) return [];

        const result = await client.listTools();
        const prefix = this.options.prefix ?? `tool_${client.getServerId() ?? 'mcp'}`;

        return result.tools.map(tool => {
            const mcpTool = tool as any;
            return {
                name: `${prefix}_${tool.name}`,
                description: tool.description || `Execute ${tool.name}`,
                parameters: cleanSchema(tool.inputSchema),
                _meta: mcpTool._meta,
            };
        });
    }
}
