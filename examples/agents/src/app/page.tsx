"use client";

import { useCoAgent } from "@copilotkit/react-core";
import { CopilotChat, CopilotKitCSSProperties } from "@copilotkit/react-ui";
import { McpSidebar } from "@/components/mcp";
import { ToolRenderer } from "@/components/ToolRenderer";

const darkTheme: CopilotKitCSSProperties = {
  "--copilot-kit-primary-color": "#444444",
  "--copilot-kit-contrast-color": "#ffffff",
  "--copilot-kit-background-color": "#0a0a0a",
  "--copilot-kit-input-background-color": "#2b2b2b",
  "--copilot-kit-secondary-color": "#3f3f46",
  "--copilot-kit-secondary-contrast-color": "#fafafa",
  "--copilot-kit-separator-color": "#3f3f46",
  "--copilot-kit-muted-color": "#a1a1aa",
};

export default function CopilotKitPage() {
  const { state } = useCoAgent({
    name: "mcpAssistant",
  });

  return (
    <main className="h-screen flex" style={darkTheme}>
      <aside className="w-80 shrink-0">
        <McpSidebar />
      </aside>
      <div className="flex-1 min-w-0 max-w-4xl mx-auto flex flex-col h-full">
        <ToolRenderer />
        <CopilotChat
          className="h-full"
          disableSystemMessage={true}
          labels={{
            title: "MCP Assistant",
            initial: "Hi!, How can I help you today?",
          }}
        />
      </div>
    </main>
  );
}
