'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function OAuthCallbackPopup() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const code = searchParams.get('code');

    if (code && window.opener) {
      window.opener.postMessage(
        { type: 'MCP_AUTH_CODE', code },
        window.location.origin
      );
      setStatus('Authentication successful! Closing...');
      setTimeout(() => window.close(), 1000);
    } else if (!window.opener) {
      setStatus('Error: No opener window found');
    } else {
      setStatus('Error: No authorization code received');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900">
      <div className="text-center text-zinc-100">
        <p className="text-lg">{status}</p>
      </div>
    </div>
  );
}
