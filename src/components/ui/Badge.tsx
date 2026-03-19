interface BadgeProps {
    label: string;
    variant?: "campaign" | "source" | "medium" | "tag" | "status-active" | "status-paused" | "status-archived" | "default";
    color?: string | null; // hex color for custom tag colors
    className?: string;
}

const variantStyles: Record<string, string> = {
    campaign: "bg-violet-50 text-violet-700 border border-violet-100",
    source: "bg-cyan-50 text-cyan-700 border border-cyan-100",
    medium: "bg-amber-50 text-amber-700 border border-amber-100",
    tag: "bg-slate-100 text-slate-600",
    "status-active": "bg-emerald-50 text-emerald-700 border border-emerald-100",
    "status-paused": "bg-amber-50 text-amber-700 border border-amber-100",
    "status-archived": "bg-slate-100 text-slate-500",
    default: "bg-slate-100 text-slate-600",
};

export function Badge({ label, variant = "default", color, className = "" }: BadgeProps) {
    const base = "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium max-w-[120px] truncate";
    const variantClass = variantStyles[variant] || variantStyles.default;

    const style =
        color && variant === "tag"
            ? { backgroundColor: color + "20", color, borderColor: color + "40", border: "1px solid" }
            : undefined;

    return (
        <span className={`${base} ${variantClass} ${className}`} style={style} title={label}>
            {label}
        </span>
    );
}

export function StatusDot({ status }: { status: string }) {
    const colors: Record<string, string> = {
        ACTIVE: "bg-emerald-500",
        PAUSED: "bg-amber-500",
        ARCHIVED: "bg-slate-400",
    };
    return (
        <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors[status] || "bg-slate-400"}`}
        />
    );
}
