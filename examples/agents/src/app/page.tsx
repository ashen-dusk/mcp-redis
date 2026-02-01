"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import { CopilotChat, CopilotKitCSSProperties } from "@copilotkit/react-ui";
import { McpSidebar } from "@/components/mcp";
import { ToolRenderer } from "@/components/ToolRenderer";
import { useMcp, useMcpApp } from "@mcp-ts/sdk/client/react";
import { useEffect, useRef } from "react";
import type { AgentSubscriber } from "@ag-ui/client";

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
  const iframeRef = useRef<HTMLIFrameElement>(null!);

  // Connect to MCP server via SSEClient
  const { client, connections } = useMcp({
    url: '/api/mcp',
    identity: 'demo-user-123',
  });

  // Setup AppHost for MCP Apps (only when client is available)
  const { host } = useMcpApp(client!, iframeRef);

  // Get agent instance from CopilotKit
  const { agent } = useAgent();

  /**
   * Subscribe to agent events to capture mcp-apps-ui custom events
   */
  useEffect(() => {
    if (!agent || !host) return;

    const subscriber: AgentSubscriber = {
      onCustomEvent: ({ event }) => {
        console.log("[Page] Custom event received:", event.name, event.value);

        // Listen for mcp-apps-ui events emitted by the middleware
        if (event.name === "mcp-apps-ui") {
          const eventData = event.value as any;
          const { resourceUri, sessionId } = eventData;

          if (resourceUri && sessionId) {
            console.log("[Page] Launching MCP App:", resourceUri, "for session:", sessionId);

            // Launch the MCP app using AppHost
            host.launch(resourceUri, sessionId).catch((error: Error) => {
              console.error("[Page] Failed to launch MCP app:", error);
            });
          }
        }
      },
      onRunStartedEvent: () => {
        console.log("[Page] Agent started running");
      },
      onRunFinalized: () => {
        console.log("[Page] Agent finished running");
      },
      onStateChanged: (state) => {
        console.log("[Page] State changed:", state);
      },
    };

    const { unsubscribe } = agent.subscribe(subscriber);
    return () => unsubscribe();
  }, [agent, host]);

  /**
   * Preload UI resources when connections are established
   */
  useEffect(() => {
    if (!host || connections.length === 0) return;

    // Preload resources from all connected tools
    for (const connection of connections) {
      if (connection.tools.length > 0) {
        console.log(`[Page] Preloading ${connection.tools.length} tools from ${connection.serverName}`);
        host.preload(connection.tools);
      }
    }
  }, [host, connections]);

  return (
    <main className="h-screen flex" style={darkTheme}>
      <aside className="w-80 shrink-0">
        <McpSidebar />
      </aside>
      <div className="flex-1 min-w-0 max-w-4xl mx-auto flex flex-col h-full">
        <ToolRenderer />

        {/* MCP App UI iframe - managed by AppHost */}
        {connections.length > 0 && (
          <div className="border-b border-gray-700 bg-gray-900 p-4">
            <h3 className="text-sm font-semibold text-white mb-2">MCP App UI</h3>
            <div className="border border-gray-700 rounded overflow-hidden">
              <iframe
                ref={iframeRef}
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                className="w-full h-96 bg-white"
                title="MCP App UI"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Connected sessions: {connections.map((c) => c.serverName).join(', ')}
            </p>
          </div>
        )}

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
