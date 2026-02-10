"use client";

import { useRenderToolCall, type ActionRenderPropsNoArgs } from "@copilotkit/react-core";
import { useMcpApps } from "@mcp-ts/sdk/client/react";
import { useMcpContext } from "./mcp";
import { MCPToolCall } from "./mcp-tool-call";

type RenderProps = ActionRenderPropsNoArgs<[]> & { name?: string };

const ToolCallRenderer: React.FC<RenderProps> = (props) => {
  const { name = "", args, result, status } = props;
  const { mcpClient } = useMcpContext();
  const { getAppMetadata, McpAppRenderer } = useMcpApps(mcpClient);

  // Get metadata - this is fast and looks up current connections
  const metadata = getAppMetadata(name);

  // Normalize status
  const normalizedStatus = status === "complete" || status === "inProgress" || status === "executing" 
    ? status 
    : "executing";

  // If no MCP app found for this tool, render the default MCPToolCall view only
  if (!metadata) {
    return (
      <MCPToolCall 
        name={name}
        args={args} 
        result={result} 
        status={normalizedStatus} 
      />
    );
  }

  // Render both MCPToolCall (for debugging) and McpAppRenderer (for UI)
  // McpAppRenderer is memoized to prevent flickering
  return (
    <>
      <MCPToolCall 
        name={name}
        args={args} 
        result={result} 
        status={normalizedStatus} 
      />
      <McpAppRenderer
        metadata={metadata}
        input={args}
        result={result}
        status={normalizedStatus}
        sseClient={mcpClient?.sseClient}
      />
    </>
  );
};

export function ToolRenderer() {
  useRenderToolCall({
    name: "*",
    render: ToolCallRenderer as (props: ActionRenderPropsNoArgs<[]>) => React.ReactElement,
  });

  return null;
}
