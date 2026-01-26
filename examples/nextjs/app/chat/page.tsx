'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, Suspense } from 'react';
import ChatInput from '@/components/chat-input';
import { useChat } from '@ai-sdk/react';
import {
    DefaultChatTransport,
    getToolName,
    type DynamicToolUIPart,
    type ToolUIPart,
    isToolUIPart,
} from 'ai';
import { FiUser, FiTool, FiAlertCircle, FiStopCircle, FiRefreshCcw, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { RiRobot2Line } from 'react-icons/ri';
import { useState } from 'react';

function CollapsibleToolCall({
    toolPart,
    toolName,
    displayName,
    index
}: {
    toolPart: ToolUIPart<any> | DynamicToolUIPart,
    toolName: string,
    displayName: string,
    index: number
}) {
    const [isCollapsed, setIsCollapsed] = useState(true);

    return (
        <div key={index} className="my-6 p-5 bg-zinc-950/50 rounded-2xl border border-zinc-800 w-full overflow-hidden transition-all duration-300 shadow-sm hover:border-zinc-700">
            <div className="flex gap-4 items-center">
                <div className="p-2 bg-zinc-900 rounded-xl border border-zinc-800 shadow-inner">
                    <FiTool className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-zinc-200 truncate uppercase tracking-wider">
                        {displayName}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${toolPart.state === 'output-available' ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-900/30' :
                        toolPart.state === 'output-error' ? 'text-red-400 bg-red-950/40 border border-red-900/30' :
                            'text-zinc-400 bg-zinc-800/50 border border-zinc-700/30 animate-pulse'
                        }`}>
                        {toolPart.state.replace('-', ' ')}
                    </div>
                    {(toolPart.state === 'output-available' || toolPart.state === 'output-error' || toolPart.input) && (
                        <button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
                        >
                            {isCollapsed ? <FiChevronDown className="w-4 h-4" /> : <FiChevronUp className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>

            {!isCollapsed && (
                <div className="mt-4 space-y-4 animate-in fade-in duration-300">
                    {(toolPart.state === 'input-streaming' || toolPart.state === 'input-available') && toolPart.input && (
                        <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 shadow-inner">
                            <div className="text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">Input Parameters</div>
                            <pre className="text-xs font-mono overflow-x-auto text-zinc-400 leading-relaxed max-h-[300px]">
                                {JSON.stringify(toolPart.input, null, 2)}
                            </pre>
                        </div>
                    )}

                    {toolPart.state === 'output-available' && (
                        <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 shadow-inner">
                            <div className="text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">Execution Result</div>
                            <div className="text-xs font-mono overflow-x-auto text-emerald-400/90 leading-relaxed max-h-[500px] whitespace-pre-wrap break-words">
                                {typeof toolPart.output === 'string'
                                    ? toolPart.output
                                    : JSON.stringify(toolPart.output, null, 2)}
                            </div>
                        </div>
                    )}

                    {toolPart.state === 'output-error' && (
                        <div className="bg-red-950/10 p-4 rounded-xl border border-red-900/20 flex gap-3 shadow-inner">
                            <FiAlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="text-xs font-medium text-red-400 leading-relaxed">
                                {toolPart.errorText}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ChatContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('sessionId') || 'DGHk2UhPsLQU';
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { error, status, sendMessage, messages, regenerate, stop } = useChat({
        transport: new DefaultChatTransport({ api: '/api/chat' }),
    });

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex flex-col min-h-screen w-full bg-[var(--background)] overflow-x-hidden text-[var(--foreground)] font-sans antialiased">

            {/* Content Area */}
            <main className="flex flex-col items-center flex-1 w-full pt-10 pb-40 overflow-y-auto overflow-x-hidden">
                <div className="w-full max-w-[850px] px-6 space-y-10">

                    {/* Minimal Empty State */}
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24 text-center opacity-0 animate-in fade-in duration-700 fill-mode-forwards">
                            <h2 className="text-2xl font-bold tracking-tight text-zinc-200 mb-2">AI Playground</h2>
                        </div>
                    )}

                    {messages.map(m => (
                        <div key={m.id} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Avatar */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 border ${m.role === 'user'
                                ? 'bg-zinc-800 border-zinc-700'
                                : 'bg-zinc-100 border-zinc-200'
                                }`}>
                                {m.role === 'user' ? (
                                    <FiUser className="w-4 h-4 text-zinc-400" />
                                ) : (
                                    <RiRobot2Line className="w-4 h-4 text-zinc-900" />
                                )}
                            </div>

                            <div className={`flex flex-col max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'} gap-1.5`}>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                    {m.role === 'user' ? 'User' : 'Assistant'}
                                </div>

                                <div className={`rounded-2xl px-5 py-3.5 shadow-sm text-sm border ${m.role === 'user'
                                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                                    } whitespace-pre-wrap leading-relaxed`}>
                                    {m.parts.map((part, index) => {
                                        if (part.type === 'text') {
                                            return <div key={index}>{part.text}</div>;
                                        }

                                        if (part.type === 'step-start') {
                                            return index > 0 ? (
                                                <div key={index} className="my-4 border-t border-zinc-800" />
                                            ) : null;
                                        }

                                        if (isToolUIPart(part)) {
                                            const toolPart = part as ToolUIPart<any> | DynamicToolUIPart;
                                            const toolName = getToolName(toolPart);
                                            const displayName = toolPart.title || toolName;

                                            return (
                                                <CollapsibleToolCall
                                                    key={index}
                                                    toolPart={toolPart}
                                                    toolName={toolName}
                                                    displayName={displayName}
                                                    index={index}
                                                />
                                            );
                                        }
                                        return null;
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}

                    {(status === 'submitted' || status === 'streaming') && (
                        <div className="flex gap-4 animate-in fade-in duration-300">
                            <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0 animate-pulse">
                                <RiRobot2Line className="w-4 h-4 text-zinc-900" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Thinking...</div>
                                <button
                                    type="button"
                                    onClick={stop}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded border border-red-900/30 w-fit transition-all"
                                >
                                    <FiStopCircle className="w-3.5 h-3.5" /> STOP
                                </button>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/30 flex flex-col items-center gap-3 text-center">
                            <div className="flex items-center gap-2 text-red-500">
                                <FiAlertCircle className="w-5 h-5" />
                                <span className="text-xs font-bold uppercase tracking-wide">Error</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => regenerate()}
                                className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
                            >
                                <FiRefreshCcw className="w-3.5 h-3.5 mr-2 inline" /> Retry
                            </button>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </main>

            <ChatInput status={status} onSend={data => sendMessage(data as any)} />
        </div>
    );
}

export default function Chat() {
    return (
        <Suspense fallback={null}>
            <ChatContent />
        </Suspense>
    );
}
