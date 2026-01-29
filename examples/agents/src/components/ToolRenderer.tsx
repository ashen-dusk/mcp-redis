"use client";

import {
  useRenderToolCall,
  type ActionRenderPropsNoArgs,
} from "@copilotkit/react-core";
import type React from "react";
import { MCPToolCall } from "./mcp-tool-call";

type RenderProps = ActionRenderPropsNoArgs<[]> & { name?: string };

const defaultRender: React.ComponentType<RenderProps> = (props: RenderProps) => {
  const { name = "", status, args, result } = props;
  const toolStatus = (status === "complete" || status === "inProgress" || status === "executing")
    ? status
    : "executing";
  return <MCPToolCall status={toolStatus} name={name} args={args} result={result} />;
};

export function ToolRenderer() {

  useRenderToolCall({
    name: "*",
    render: defaultRender as (props: ActionRenderPropsNoArgs<[]>) => React.ReactElement,
  });

  return null;
}