"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Sparkles,
    Code2,
    ExternalLink,
    Loader2,
    Download,
    Wand2,
    Eye,
    RefreshCw,
    ArrowLeft,
} from "lucide-react";
import { onInvokeAI } from "@/modules/actions";
import Link from "next/link";

/* ─── Constants ──────────────────────────────────────────── */

const STATUS = {
    IDLE: "idle",
    GENERATING: "generating",
    BUILDING: "building",
    READY: "ready",
    ERROR: "error",
};

const STATUS_CONFIG = {
    [STATUS.IDLE]: {
        label: "Ready",
        dotColor: "bg-zinc-400",
        textColor: "text-zinc-500",
    },
    [STATUS.GENERATING]: {
        label: "AI is building…",
        dotColor: "bg-amber-500",
        textColor: "text-amber-600",
        pulse: true,
    },
    [STATUS.BUILDING]: {
        label: "Starting preview…",
        dotColor: "bg-blue-500",
        textColor: "text-blue-600",
        pulse: true,
    },
    [STATUS.READY]: {
        label: "Live",
        dotColor: "bg-emerald-500",
        textColor: "text-emerald-600",
    },
    [STATUS.ERROR]: {
        label: "Error",
        dotColor: "bg-red-500",
        textColor: "text-red-600",
    },
};

const SUGGESTIONS = [
    "A modern SaaS landing page with pricing cards and testimonials",
    "A portfolio page with project gallery and animated hero section",
    "A coffee shop website with menu, about us, and contact section",
    "A todo app dashboard with sidebar navigation and dark theme",
];

/* ─── StatusDot ──────────────────────────────────────────── */

function StatusDot({ status }) {
    const config = STATUS_CONFIG[status];
    return (
        <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
                {config.pulse && (
                    <span
                        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${config.dotColor}`}
                    />
                )}
                <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${config.dotColor}`}
                />
            </span>
            <span className={`text-xs font-medium ${config.textColor}`}>
                {config.label}
            </span>
        </span>
    );
}

/* ─── Page ───────────────────────────────────────────────── */

export default function BuildPage() {
    const [prompt, setPrompt] = useState("");
    const [status, setStatus] = useState(STATUS.IDLE);
    const [previewUrl, setPreviewUrl] = useState("");
    const [sandboxId, setSandboxId] = useState("");
    const [error, setError] = useState("");
    const [logs, setLogs] = useState([]);
    const [isPreparingDownload, setIsPreparingDownload] = useState(false);
    const pollRef = useRef(null);
    const iframeRef = useRef(null);

    const addLog = (message) => {
        setLogs((prev) => [
            ...prev,
            { time: new Date().toLocaleTimeString(), message },
        ]);
    };

    const pollByEventId = (eventId) => {
        let attempts = 0;
        pollRef.current = setInterval(async () => {
            attempts++;
            try {
                const res = await fetch(`/api/build?eventId=${eventId}`);
                const data = await res.json();
                if (data.ready) {
                    clearInterval(pollRef.current);
                    setPreviewUrl(data.url);
                    setSandboxId(data.sandboxId || "");
                    setStatus(STATUS.READY);
                    addLog("✅ Preview is live!");
                } else if (data.status === "error") {
                    clearInterval(pollRef.current);
                    setStatus(STATUS.ERROR);
                    setError(data.error || "Build failed");
                    addLog(`❌ Error: ${data.error}`);
                } else if (attempts > 120) {
                    clearInterval(pollRef.current);
                    setStatus(STATUS.ERROR);
                    setError("Build took too long — timed out");
                    addLog("❌ Timeout waiting for build to complete");
                }
            } catch {
                // keep polling on network blips
            }
        }, 3000);
    };

    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setStatus(STATUS.GENERATING);
        setPreviewUrl("");
        setSandboxId("");
        setError("");
        setLogs([]);
        addLog("🚀 Sending prompt to AI agents…");

        try {
            const result = await onInvokeAI(prompt.trim());
            addLog("📦 Inngest event sent. Agents are working…");
            setStatus(STATUS.BUILDING);

            const eventId = result?.ids?.[0];
            if (!eventId) {
                throw new Error("No event ID returned from Inngest");
            }

            addLog("⏳ Waiting for sandbox to spin up…");
            addLog("🔍 Polling for preview readiness…");
            pollByEventId(eventId);
        } catch (err) {
            setStatus(STATUS.ERROR);
            setError(err.message || "Failed to invoke AI");
            addLog(`❌ Error: ${err.message}`);
        }
    };

    const handleSuggestion = (text) => {
        setPrompt(text);
    };

    const handleDownloadProject = async () => {
        if (!sandboxId || isPreparingDownload) return;

        setIsPreparingDownload(true);
        addLog("📦 Preparing project archive for download…");

        try {
            const res = await fetch("/api/build/download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sandboxId }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to prepare download.");
            }

            const blob = await res.blob();
            const contentDisposition = res.headers.get("content-disposition") || "";
            const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);
            const filename = fileNameMatch?.[1] || "ripple-project.zip";

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            addLog("✅ Download started.");
        } catch (err) {
            addLog(`❌ Download failed: ${err.message}`);
            setError(err.message || "Failed to download project.");
        } finally {
            setIsPreparingDownload(false);
        }
    };

    /* ─── Render ─────────────────────────────────────────── */

    return (
        <div className="flex h-screen bg-[#fafaf9] text-zinc-900 overflow-hidden">
            {/* ─── Left Panel ─── */}
            <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-[420px] min-w-[380px] flex flex-col border-r border-zinc-200 bg-white"
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-200">
                    <Link
                        href="/"
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 text-zinc-600" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-900">
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-semibold tracking-tight text-zinc-900">
                                Ripple Builder
                            </h1>
                            <p className="text-[11px] text-zinc-400">
                                Describe → Build → Preview
                            </p>
                        </div>
                    </div>
                    <div className="ml-auto">
                        <StatusDot status={status} />
                    </div>
                </div>

                {/* Prompt Area */}
                <div className="flex-1 flex flex-col p-5 gap-4 overflow-y-auto">
                    <div>
                        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 block">
                            Describe your website
                        </label>
                        <Textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g. Create a modern SaaS landing page with a hero section, feature cards, pricing table…"
                            className="min-h-[140px] bg-[#fafaf9] border-zinc-200 text-sm text-zinc-900 placeholder:text-zinc-400 resize-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300 transition-all rounded-xl"
                            disabled={
                                status === STATUS.GENERATING || status === STATUS.BUILDING
                            }
                        />
                    </div>

                    {/* Suggestions */}
                    <AnimatePresence>
                        {status === STATUS.IDLE && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                            >
                                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-2">
                                    Try a suggestion
                                </p>
                                <div className="flex flex-col gap-2">
                                    {SUGGESTIONS.map((s, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSuggestion(s)}
                                            className="text-left text-xs px-3 py-2.5 rounded-xl bg-[#fafaf9] border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 hover:border-zinc-300 transition-all duration-200"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Generate Button */}
                    <Button
                        onClick={handleGenerate}
                        disabled={
                            !prompt.trim() ||
                            status === STATUS.GENERATING ||
                            status === STATUS.BUILDING
                        }
                        className="w-full h-11 bg-zinc-900 hover:bg-zinc-700 text-white font-medium rounded-xl shadow-md shadow-zinc-900/10 transition-all duration-300 disabled:opacity-40 disabled:shadow-none cursor-pointer"
                    >
                        {status === STATUS.GENERATING || status === STATUS.BUILDING ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {status === STATUS.GENERATING
                                    ? "AI is building…"
                                    : "Starting preview…"}
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-4 h-4 mr-2" />
                                Generate Website
                            </>
                        )}
                    </Button>

                    {/* Error */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs"
                        >
                            {error}
                        </motion.div>
                    )}

                    {/* Logs */}
                    {logs.length > 0 && (
                        <div>
                            <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-2">
                                Build log
                            </p>
                            <div className="flex flex-col gap-1 bg-[#fafaf9] rounded-xl border border-zinc-200 p-3 max-h-[200px] overflow-y-auto">
                                {logs.map((log, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -5 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="text-[11px] font-mono text-zinc-500"
                                    >
                                        <span className="text-zinc-400">{log.time}</span>{" "}
                                        {log.message}
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-zinc-200 flex items-center gap-2 text-[11px] text-zinc-400">
                    <Code2 className="w-3 h-3" />
                    <span>Powered by Gemini + E2B Sandbox</span>
                </div>
            </motion.div>

            {/* ─── Right Panel: Preview ─── */}
            <div className="flex-1 flex flex-col bg-[#fafaf9]">
                {/* Preview Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 bg-white/70 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <Eye className="w-4 h-4 text-zinc-400" />
                        <span className="text-xs font-medium text-zinc-500">Preview</span>
                        {previewUrl && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-emerald-200 text-emerald-600 bg-emerald-50">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Live
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {previewUrl && (
                            <>
                                <button
                                    onClick={() => iframeRef.current?.contentWindow?.location.reload()}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => window.open(previewUrl, "_blank")}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={handleDownloadProject}
                                    disabled={!sandboxId || isPreparingDownload}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isPreparingDownload ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Preparing...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-3.5 h-3.5" />
                                            Download Project
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Preview Content */}
                <div className="flex-1 relative">
                    <AnimatePresence mode="wait">
                        {status === STATUS.IDLE && (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                            >
                                <div className="w-20 h-20 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center shadow-sm">
                                    <Sparkles className="w-8 h-8 text-zinc-300" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm text-zinc-500 font-medium">
                                        No preview yet
                                    </p>
                                    <p className="text-xs text-zinc-400 mt-1">
                                        Describe your website and click Generate
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {(status === STATUS.GENERATING || status === STATUS.BUILDING) && (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex flex-col items-center justify-center gap-6"
                            >
                                {/* Animated loading ring */}
                                <div className="relative">
                                    <motion.div
                                        animate={{
                                            scale: [1, 1.15, 1],
                                            opacity: [0.3, 0.6, 0.3],
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            ease: "easeInOut",
                                        }}
                                        className="w-24 h-24 rounded-full bg-zinc-200/60 blur-xl absolute inset-0"
                                    />
                                    <div className="w-24 h-24 rounded-full border border-zinc-300 flex items-center justify-center relative bg-white shadow-sm">
                                        <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm text-zinc-600 font-medium">
                                        {status === STATUS.GENERATING
                                            ? "AI agents are crafting your website…"
                                            : "Starting the preview server…"}
                                    </p>
                                    <p className="text-xs text-zinc-400 mt-1">
                                        This can take 1–2 minutes
                                    </p>
                                </div>

                                {/* Skeleton preview hint */}
                                <div className="w-full max-w-lg px-8 mt-4 space-y-3 opacity-40">
                                    <Skeleton className="h-8 w-3/4 bg-zinc-200 rounded-lg" />
                                    <Skeleton className="h-4 w-full bg-zinc-200 rounded-lg" />
                                    <Skeleton className="h-4 w-5/6 bg-zinc-200 rounded-lg" />
                                    <div className="flex gap-3 mt-4">
                                        <Skeleton className="h-24 flex-1 bg-zinc-200 rounded-xl" />
                                        <Skeleton className="h-24 flex-1 bg-zinc-200 rounded-xl" />
                                        <Skeleton className="h-24 flex-1 bg-zinc-200 rounded-xl" />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {status === STATUS.READY && previewUrl && (
                            <motion.iframe
                                key="preview"
                                ref={iframeRef}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                src={previewUrl}
                                className="w-full h-full border-0"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                            />
                        )}

                        {status === STATUS.ERROR && (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                            >
                                <div className="w-20 h-20 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
                                    <Code2 className="w-8 h-8 text-red-400" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm text-red-600 font-medium">
                                        Build failed
                                    </p>
                                    <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                                        {error || "An unexpected error occurred"}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setStatus(STATUS.IDLE);
                                        setError("");
                                    }}
                                    className="px-4 py-2 text-sm font-medium rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors"
                                >
                                    Try again
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
