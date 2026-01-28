/**
 * AG-UI Middleware for MCP Tool Execution
 *
 * This middleware intercepts tool calls from remote agents and executes
 * MCP tools server-side, then returns the results to the agent.
 *
 * @requires @ag-ui/client - This adapter requires @ag-ui/client as a peer dependency
 */

import { Observable, from, mergeMap, of, concat } from 'rxjs';
import {
    Middleware,
    type AbstractAgent,
    type RunAgentInput,
    type BaseEvent,
    type ToolCallEndEvent,
} from '@ag-ui/client';
import { MCPClient } from '../server/mcp/oauth-client.js';
import { MultiSessionClient } from '../server/mcp/multi-session-client.js';
import type { CopilotKitAction } from './copilotkit-adapter.js';

/**
 * Tool definition format for AG-UI input.tools
 */
export interface AgUiTool {
    name: string;
    description: string;
    parameters?: Record<string, any>;
}

export interface McpToolExecutorConfig {
    /**
     * MCP client or MultiSessionClient for executing tools
     */
    client: MCPClient | MultiSessionClient;

    /**
     * Prefix used for MCP tool names (used to identify MCP tools)
     * @default 'server-'
     */
    toolPrefix?: string;

    /**
     * Pre-loaded actions (optional - will be loaded if not provided)
     */
    actions?: CopilotKitAction[];

    /**
     * Pre-loaded tools in AG-UI format (optional - will be generated from actions if not provided)
     */
    tools?: AgUiTool[];

    /**
     * Identity for session management
     */
    identity?: string;
}

/**
 * AG-UI Middleware that executes MCP tools server-side.
 *
 * When the agent makes a tool call for an MCP tool (identified by prefix),
 * this middleware intercepts the call, executes it via the MCP client,
 * and returns the result to the agent.
 *
 * @example
 * ```typescript
 * import { HttpAgent } from '@ag-ui/client';
 * import { McpToolExecutorMiddleware } from '@mcp-ts/sdk/adapters/agui-middleware';
 *
 * const mcpMiddleware = new McpToolExecutorMiddleware({
 *   client: multiSessionClient,
 *   toolPrefix: 'server-',
 * });
 *
 * const agent = new HttpAgent({ url: 'http://localhost:8000/agent' });
 * agent.use(mcpMiddleware);
 * ```
 */
export class McpToolExecutorMiddleware extends Middleware {
    private client: MCPClient | MultiSessionClient;
    private toolPrefix: string;
    private actions: CopilotKitAction[] | null;
    private tools: AgUiTool[] | null;
    private actionsLoaded: boolean = false;
    private toolCallArgsBuffer: Map<string, string> = new Map();
    private toolCallNames: Map<string, string> = new Map();

    constructor(config: McpToolExecutorConfig) {
        super();
        this.client = config.client;
        this.toolPrefix = config.toolPrefix ?? 'server-';
        this.actions = config.actions ?? null;
        this.tools = config.tools ?? null;
        if (this.actions) {
            this.actionsLoaded = true;
            // Generate tools from actions if not provided
            if (!this.tools) {
                this.tools = this.actionsToTools(this.actions);
            }
        }
    }

    /**
     * Convert actions to AG-UI tool format
     */
    private actionsToTools(actions: CopilotKitAction[]): AgUiTool[] {
        return actions.map(action => ({
            name: action.name,
            description: action.description,
            parameters: action.parameters || { type: 'object', properties: {} },
        }));
    }

    /**
     * Check if a tool name is an MCP tool
     */
    private isMcpTool(toolName: string): boolean {
        return toolName.startsWith(this.toolPrefix);
    }

    /**
     * Load actions from the MCP client if not already loaded
     */
    private async ensureActionsLoaded(): Promise<void> {
        if (this.actionsLoaded) return;

        const { CopilotKitAdapter } = await import('./copilotkit-adapter.js');
        const adapter = new CopilotKitAdapter(this.client);
        this.actions = await adapter.getActions();
        this.actionsLoaded = true;
    }

    /**
     * Execute an MCP tool and return the result
     */
    private async executeTool(toolName: string, args: Record<string, any>): Promise<string> {
        await this.ensureActionsLoaded();

        const action = this.actions?.find(a => a.name === toolName);
        if (!action) {
            return `Error: Tool not found: ${toolName}`;
        }

        if (!action.handler) {
            return `Error: Tool has no handler: ${toolName}`;
        }

        try {
            console.log(`[McpToolExecutor] Executing tool: ${toolName}`, args);
            const result = await action.handler(args);
            console.log(`[McpToolExecutor] Tool result:`, typeof result === 'string' ? result.slice(0, 200) : result);
            return typeof result === 'string' ? result : JSON.stringify(result);
        } catch (error: any) {
            console.error(`[McpToolExecutor] Error executing tool:`, error);
            return `Error executing tool: ${error.message || String(error)}`;
        }
    }

    /**
     * Generate a unique message ID
     */
    private generateMessageId(): string {
        return `mcp_result_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    run(input: RunAgentInput, next: AbstractAgent): Observable<BaseEvent> {
        // Clear buffers for new run
        this.toolCallArgsBuffer.clear();
        this.toolCallNames.clear();

        console.log(`[McpToolExecutor] Starting run with ${this.actions?.length ?? 0} registered actions`);
        console.log(`[McpToolExecutor] Tool prefix: "${this.toolPrefix}"`);

        // Inject MCP tools into input.tools
        if (this.tools && this.tools.length > 0) {
            const existingTools = input.tools || [];
            input.tools = [...existingTools, ...this.tools];
            console.log(`[McpToolExecutor] Injected ${this.tools.length} MCP tools into input.tools`);
            console.log(`[McpToolExecutor] Total tools: ${input.tools.length}`);
            console.log(`[McpToolExecutor] Tool names:`, this.tools.map(t => t.name));
        }

        return next.run(input).pipe(
            mergeMap((event: BaseEvent) => {
                // Track tool call names from TOOL_CALL_START events
                if (event.type === 'TOOL_CALL_START') {
                    const startEvent = event as any;
                    if (startEvent.toolCallId && startEvent.toolCallName) {
                        this.toolCallNames.set(startEvent.toolCallId, startEvent.toolCallName);
                        const isMcp = this.isMcpTool(startEvent.toolCallName);
                        console.log(`[McpToolExecutor] TOOL_CALL_START: ${startEvent.toolCallName} (id: ${startEvent.toolCallId}, isMCP: ${isMcp})`);
                    }
                }

                // Accumulate tool call arguments from TOOL_CALL_ARGS events
                if (event.type === 'TOOL_CALL_ARGS') {
                    const argsEvent = event as any;
                    if (argsEvent.toolCallId && argsEvent.delta) {
                        const existing = this.toolCallArgsBuffer.get(argsEvent.toolCallId) || '';
                        this.toolCallArgsBuffer.set(argsEvent.toolCallId, existing + argsEvent.delta);
                    }
                }

                // Handle TOOL_CALL_END - execute MCP tools
                if (event.type === 'TOOL_CALL_END') {
                    const endEvent = event as ToolCallEndEvent;
                    const toolName = this.toolCallNames.get(endEvent.toolCallId);

                    console.log(`[McpToolExecutor] TOOL_CALL_END: ${toolName ?? 'unknown'} (id: ${endEvent.toolCallId})`);

                    if (toolName && this.isMcpTool(toolName)) {
                        // Parse accumulated arguments
                        const argsString = this.toolCallArgsBuffer.get(endEvent.toolCallId) || '{}';
                        let args: Record<string, any> = {};
                        try {
                            args = JSON.parse(argsString);
                        } catch (e) {
                            console.error(`[McpToolExecutor] Failed to parse args:`, argsString);
                        }

                        console.log(`[McpToolExecutor] Intercepting MCP tool call: ${toolName}`);
                        console.log(`[McpToolExecutor] Arguments:`, JSON.stringify(args, null, 2));

                        // Execute the tool and emit result
                        return concat(
                            of(event), // Emit the TOOL_CALL_END event first
                            from(this.executeTool(toolName, args)).pipe(
                                mergeMap((result: string) => {
                                    console.log(`[McpToolExecutor] Emitting TOOL_CALL_RESULT for: ${toolName}`);
                                    // Create a TOOL_CALL_RESULT event
                                    const resultEvent: BaseEvent = {
                                        type: 'TOOL_CALL_RESULT' as any,
                                        toolCallId: endEvent.toolCallId,
                                        messageId: this.generateMessageId(),
                                        content: result,
                                        role: 'tool',
                                        timestamp: Date.now(),
                                    } as any;
                                    return of(resultEvent);
                                })
                            )
                        );
                    }
                }

                // Pass through all other events unchanged
                return of(event);
            })
        );
    }
}

/**
 * Create a function middleware for MCP tool execution.
 * This is a simpler alternative to the class-based middleware.
 *
 * @example
 * ```typescript
 * import { HttpAgent } from '@ag-ui/client';
 * import { createMcpToolMiddleware } from '@mcp-ts/sdk/adapters/agui-middleware';
 *
 * const agent = new HttpAgent({ url: 'http://localhost:8000/agent' });
 * agent.use(createMcpToolMiddleware(multiSessionClient));
 * ```
 */
export function createMcpToolMiddleware(
    client: MCPClient | MultiSessionClient,
    options: { toolPrefix?: string; actions?: CopilotKitAction[] } = {}
) {
    const middleware = new McpToolExecutorMiddleware({
        client,
        ...options,
    });

    return (input: RunAgentInput, next: AbstractAgent): Observable<BaseEvent> => {
        return middleware.run(input, next);
    };
}

// Re-export types for convenience
export { Middleware };
export type { RunAgentInput, BaseEvent, AbstractAgent, ToolCallEndEvent };
