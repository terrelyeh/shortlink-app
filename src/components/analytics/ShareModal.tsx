"use client";

import { useState } from "react";
import { X, Link2, Copy, Check, Eye, EyeOff, Loader2, Share2 } from "lucide-react";

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    linkId?: string;
    campaignFilter?: string;
    dateRange?: string;
}

export function ShareModal({ isOpen, onClose, linkId, campaignFilter, dateRange }: ShareModalProps) {
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [expiresInDays, setExpiresInDays] = useState("7");
    const [maxViews, setMaxViews] = useState("");
    const [loading, setLoading] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleCreate = async () => {
        setLoading(true);
        try {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays || "7"));

            const body: Record<string, unknown> = {
                expiresAt: expiresAt.toISOString(),
                ...(password && { password }),
                ...(maxViews && { maxViews: parseInt(maxViews) }),
                ...(linkId && { linkId }),
                ...(campaignFilter && { campaign: campaignFilter }),
                ...(dateRange && { dateRange }),
            };

            const res = await fetch("/api/share", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                const data = await res.json();
                const baseUrl = window.location.origin;
                setShareUrl(`${baseUrl}/share/${data.token}`);
            }
        } catch (err) {
            console.error("Failed to create share link:", err);
        } finally {
            setLoading(false);
        }
    };

    const copyShareUrl = async () => {
        if (!shareUrl) return;
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleClose = () => {
        setShareUrl(null);
        setPassword("");
        setMaxViews("");
        setExpiresInDays("7");
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6">
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 bg-sky-50 rounded-xl flex items-center justify-center">
                        <Share2 className="w-4 h-4 text-[#03A9F4]" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-900">Share Report</h3>
                        <p className="text-xs text-slate-500">Generate a read-only link for external viewers</p>
                    </div>
                </div>

                {!shareUrl ? (
                    <div className="space-y-4">
                        {/* Expires */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5">Expires after</label>
                            <div className="flex gap-2">
                                {["1", "7", "30"].map((d) => (
                                    <button
                                        key={d}
                                        onClick={() => setExpiresInDays(d)}
                                        className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors font-medium ${expiresInDays === d
                                                ? "bg-[#03A9F4] text-white border-[#03A9F4]"
                                                : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                            }`}
                                    >
                                        {d}d
                                    </button>
                                ))}
                                <input
                                    type="number"
                                    min="1"
                                    max="365"
                                    placeholder="Custom"
                                    value={["1", "7", "30"].includes(expiresInDays) ? "" : expiresInDays}
                                    onChange={(e) => setExpiresInDays(e.target.value)}
                                    className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5">
                                Password <span className="text-slate-300 font-normal">(optional)</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Leave blank for no password"
                                    className="w-full pr-10 pl-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
                                />
                                <button
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Max views */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5">
                                Max views <span className="text-slate-300 font-normal">(optional)</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={maxViews}
                                onChange={(e) => setMaxViews(e.target.value)}
                                placeholder="Unlimited"
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
                            />
                        </div>

                        <button
                            onClick={handleCreate}
                            disabled={loading}
                            className="w-full py-2.5 bg-[#03A9F4] text-white text-sm font-medium rounded-lg hover:bg-[#0288D1] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                            Generate Share Link
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                            <p className="text-xs font-medium text-emerald-700 mb-2">Share link created ✓</p>
                            <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-2">
                                <Link2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="text-xs text-slate-600 flex-1 truncate font-mono">{shareUrl}</span>
                                <button
                                    onClick={copyShareUrl}
                                    className="p-1 hover:bg-slate-100 rounded transition-colors shrink-0"
                                >
                                    {copied ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                                    )}
                                </button>
                            </div>
                        </div>
                        {password && (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                Password protected
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={copyShareUrl}
                                className="flex-1 py-2 text-sm font-medium bg-[#03A9F4] text-white rounded-lg hover:bg-[#0288D1] transition-colors flex items-center justify-center gap-2"
                            >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copied ? "Copied!" : "Copy Link"}
                            </button>
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
