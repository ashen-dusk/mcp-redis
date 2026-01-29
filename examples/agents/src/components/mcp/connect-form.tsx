'use client';

import { useState } from 'react';
import { nanoid } from 'nanoid';
import { ConnectConfig } from './types';

interface ConnectFormProps {
  onConnect: (config: ConnectConfig) => Promise<void>;
  connecting: boolean;
  status: string;
  error: string | null;
}

export function ConnectForm({ onConnect, connecting, status, error }: ConnectFormProps) {
  const [serverName, setServerName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [callbackUrl, setCallbackUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/oauth/callback-popup`;
    }
    return 'http://localhost:3000/oauth/callback-popup';
  });
  const [transportType, setTransportType] = useState<'sse' | 'streamable_http' | 'auto'>('auto');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const serverId = `server-${nanoid(6)}`;
    await onConnect({
      serverId,
      serverName,
      serverUrl,
      callbackUrl,
      transportType,
    });
    setServerName('');
    setServerUrl('');
  };

  const inputClass = "w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50";
  const labelClass = "block text-sm font-medium text-zinc-300 mb-1";

  return (
    <div className="p-4 border-b border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-100 mb-3">Connect to MCP Server</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="serverName" className={labelClass}>Server Name</label>
          <input
            id="serverName"
            type="text"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            placeholder="My MCP Server"
            required
            disabled={connecting}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="serverUrl" className={labelClass}>Server URL</label>
          <input
            id="serverUrl"
            type="url"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://mcp.example.com"
            required
            disabled={connecting}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="transportType" className={labelClass}>Transport</label>
          <select
            id="transportType"
            value={transportType}
            onChange={(e) => setTransportType(e.target.value as 'sse' | 'streamable_http' | 'auto')}
            disabled={connecting}
            className={inputClass}
          >
            <option value="auto">Auto</option>
            <option value="streamable_http">Streamable HTTP</option>
            <option value="sse">SSE</option>
          </select>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-950/50 px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={connecting || status !== 'connected'}
          className="w-full px-4 py-2 bg-zinc-600 hover:bg-zinc-700 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
        >
          {connecting ? 'Connecting...' : 'Connect'}
        </button>

        {status !== 'connected' && (
          <p className="text-xs text-zinc-500 text-center">
            Waiting for SSE connection...
          </p>
        )}
      </form>
    </div>
  );
}
