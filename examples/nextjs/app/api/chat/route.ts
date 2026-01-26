import { UIMessage, createAgentUIStreamResponse } from 'ai';
import { createMcpAgent } from '@/openai-agent/agent';

export async function POST(req: Request) {
    const { messages }: { messages: UIMessage[] } = await req.json();

    const agent = await createMcpAgent('demo-user-123');

    return createAgentUIStreamResponse({
        agent,
        uiMessages: messages,
    });
}