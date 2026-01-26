import { RotateCw } from "lucide-react"
import { cn } from "@/lib/utils"

export function LoadingSpinner({ className }: { className?: string }) {
    return <RotateCw className={cn("animate-spin text-muted-foreground", className)} size={16} />
}
