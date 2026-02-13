'use client';

import { ChevronDown, Plug, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { Connection } from './types';

interface ConnectionItemProps {
  connection: Connection;
  onDisconnect: (sessionId: string) => void;
}

const stateColors: Record<string, string> = {
  CONNECTED: 'bg-green-500/20 text-green-400',
  CONNECTING: 'bg-yellow-500/20 text-yellow-400',
  AUTHENTICATING: 'bg-blue-500/20 text-blue-400',
  DISCOVERING: 'bg-purple-500/20 text-purple-400',
  DISCONNECTED: 'bg-zinc-500/20 text-zinc-400',
  FAILED: 'bg-red-500/20 text-red-400',
};

export function ConnectionItem({ connection, onDisconnect }: ConnectionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const sessionIdStr = String(connection.sessionId);
  const stateColor = stateColors[connection.state] || stateColors.DISCONNECTED;
  return (
    <div className="border border-zinc-800 rounded-md overflow-hidden">
      <div
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-zinc-800/50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Plug className="w-4 h-4 text-zinc-500 shrink-0" />
          <span className="text-sm font-medium text-zinc-100 truncate">
            {connection.serverName}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${stateColor}`}>
            {connection.state}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''
            }`}
        />
      </div>

      <div
        className={`grid transition-all duration-200 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
      >
        <div className="overflow-hidden">
          <div className="px-3 py-2 space-y-2 border-t border-zinc-800 bg-zinc-900/50">
            {connection.error && (
              <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/30 p-2 rounded">
                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{connection.error}</span>
              </div>
            )}

            <div className="text-xs space-y-1 text-zinc-400">
              <div className="flex justify-between">
                <span>Session:</span>
                <span className="font-mono text-zinc-300">{sessionIdStr.slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span>ServerId:</span>
                <span className="font-mono text-zinc-300">{connection.serverId}</span>
              </div>
              <div className="flex justify-between">
                <span>URL:</span>
                <span className="font-mono text-zinc-300 truncate max-w-[150px]">{connection.serverUrl}</span>
              </div>
              <div className="flex justify-between">
                <span>Transport:</span>
                <span className="text-zinc-300">{connection.transport || 'auto'}</span>
              </div>
              <div className="flex justify-between">
                <span>Created At:</span>
                <span className="text-zinc-300">{new Date(connection.createdAt).toLocaleString()}</span>
              </div>
            </div>
            {connection.tools && connection.tools.length > 0 && (
              <div className="pt-2 border-t border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1">{connection.tools.length} tools available</p>
                <div className="flex flex-wrap gap-1">
                  {connection.tools.slice(0, 5).map((tool) => (
                    <span key={tool.name} className="text-xs bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">
                      {tool.name}
                    </span>
                  ))}
                  {connection.tools.length > 5 && (
                    <span className="text-xs text-zinc-500">+{connection.tools.length - 5} more</span>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDisconnect(sessionIdStr);
              }}
              className="w-full mt-2 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-red-900/50 rounded transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
