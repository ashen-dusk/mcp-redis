import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle, Loader2, Ban } from "lucide-react"

interface MCPToolCallProps {
    name: string
    state?: string
    input?: any
    output?: any
    errorText?: string
}

export default function MCPToolCall({ name, state, input, output, errorText }: MCPToolCallProps) {
    return (
        <div className="w-full rounded-lg border bg-card text-card-foreground shadow-sm my-2 overflow-hidden">
            <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium">
                <span className="flex-1 truncate font-mono">{name}</span>
                {state === 'input-streaming' && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
                {state === 'output-available' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                {state === 'output-error' && <XCircle className="h-3.5 w-3.5 text-red-500" />}
            </div>

            <div className="p-3 space-y-3 text-xs">
                {input && (
                    <div className="space-y-1">
                        <div className="font-semibold text-muted-foreground">Input</div>
                        <pre className="overflow-x-auto rounded bg-muted/50 p-2 font-mono">
                            {JSON.stringify(input, null, 2)}
                        </pre>
                    </div>
                )}
                {output && (
                    <div className="space-y-1">
                        <div className="font-semibold text-muted-foreground">Output</div>
                        <pre className="overflow-x-auto rounded bg-muted/50 p-2 font-mono text-green-700 dark:text-green-400">
                            {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
                        </pre>
                    </div>
                )}
                {errorText && (
                    <div className="space-y-1">
                        <div className="font-semibold text-muted-foreground">Error</div>
                        <pre className="overflow-x-auto rounded bg-red-50 dark:bg-red-950/20 p-2 font-mono text-red-600 dark:text-red-400">
                            {errorText}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    )
}
