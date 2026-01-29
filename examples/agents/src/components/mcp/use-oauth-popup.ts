import { useEffect } from 'react';
import { Connection } from './types';

export function useOAuthPopup(
  connections: Connection[],
  finishAuth: (sessionId: string, code: string) => Promise<unknown>
) {
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === 'MCP_AUTH_CODE' && event.data.code) {
        let authenticatingSession = connections.find(c => c.state === 'AUTHENTICATING');

        if (!authenticatingSession) {
          authenticatingSession = connections.find(
            c => c.state === 'FAILED' &&
            (c.error?.toLowerCase().includes('oauth') || c.error?.toLowerCase().includes('auth'))
          );
        }

        if (authenticatingSession) {
          try {
            await finishAuth(authenticatingSession.sessionId, event.data.code);
          } catch (err) {
            console.error('Failed to finish auth:', err);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [connections, finishAuth]);
}
