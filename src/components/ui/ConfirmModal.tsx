"use client";

import { useEffect } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmModal({
    isOpen,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-4">
                    <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${destructive ? "bg-red-50" : "bg-amber-50"
                            }`}
                    >
                        {destructive ? (
                            <Trash2 className="w-5 h-5 text-red-500" />
                        ) : (
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                        {description && (
                            <p className="text-sm text-slate-500 mt-1">{description}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-6">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onCancel();
                        }}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${destructive
                                ? "bg-red-500 text-white hover:bg-red-600"
                                : "bg-[#03A9F4] text-white hover:bg-[#0288D1]"
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
