import { cn } from "@/lib/utils"

interface UserMessageProps {
    message: { text: string }
    parts?: any[]
}

export function UserMessage({ message, parts }: UserMessageProps) {
    return (
        <div className="flex w-full items-end justify-end gap-2">
            <div className="relative max-w-[80%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground">
                <div className="whitespace-pre-wrap text-sm">{message.text}</div>
                {/* Render file parts if any */}
                {parts && parts.length > 0 && (
                    <div className="mt-2 text-xs opacity-90">
                        {parts.map((p, i) => (
                            <div key={i} className="flex items-center gap-1 bg-white/10 p-1 rounded">
                                <span>📄 File uploaded</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-primary font-bold text-primary-foreground shadow">
                U
            </div>
        </div>
    )
}

interface AssistantMessageProps {
    text: string
    parts?: any[]
}

export function AssistantMessage({ text, parts }: AssistantMessageProps) {
    return (
        <div className="flex w-full items-start gap-2">
            <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-muted font-bold text-muted-foreground shadow">
                AI
            </div>
            <div className="relative max-w-[80%] rounded-2xl bg-muted px-4 py-3 text-foreground">
                {text && <div className="whitespace-pre-wrap text-sm">{text}</div>}
                {parts && parts.map((part, i) => (
                    <div key={i}>{JSON.stringify(part)}</div>
                ))}
            </div>
        </div>
    )
}
