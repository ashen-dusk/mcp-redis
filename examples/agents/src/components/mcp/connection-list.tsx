'use client';

import { Loader2 } from 'lucide-react';
import { Connection } from './types';
import { ConnectionItem } from './connection-item';

interface ConnectionListProps {
  connections: Connection[];
  isInitializing: boolean;
  onDisconnect: (sessionId: string) => void;
}

export function ConnectionList({ connections, isInitializing, onDisconnect }: ConnectionListProps) {
  if (isInitializing) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Checking existing sessions...</span>
        </div>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-zinc-500 text-sm text-center">
          No MCP servers connected.<br />
          Add one above to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
        Connected Servers ({connections.length})
      </h3>
      {connections.map((connection) => (
        <ConnectionItem
          key={connection.sessionId}
          connection={connection}
          onDisconnect={onDisconnect}
        />
      ))}
    </div>
  );
}
