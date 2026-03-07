"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Sparkles,
    Code2,
    ExternalLink,
    Loader2,
    Wand2,
    Eye,
    RefreshCw,
} from "lucide-react";
import { onInvokeAI } from "@/modules/actions";

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
        color: "bg-zinc-500",
        textColor: "text-zinc-400",
    },
    [STATUS.GENERATING]: {
        label: "AI is building…",
        color: "bg-amber-500",
        textColor: "text-amber-400",
        pulse: true,
    },
    [STATUS.BUILDING]: {
        label: "Starting preview…",
        color: "bg-blue-500",
        textColor: "text-blue-400",
        pulse: true,
    },
    [STATUS.READY]: {
        label: "Live",
        color: "bg-emerald-500",
        textColor: "text-emerald-400",
    },
    [STATUS.ERROR]: {
        label: "Error",
        color: "bg-red-500",
        textColor: "text-red-400",
    },
};

function StatusDot({ status }) {
    const config = STATUS_CONFIG[status];
    return (
        <span className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
                {config.pulse && (
                    <span
                        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${config.color}`}
                    />
                )}
                <span
                    className={`relative inline-flex h-2.5 w-2.5 rounded-full ${config.color}`}
                />
            </span>
            <span className={`text-xs font-medium ${config.textColor}`}>
                {config.label}
            </span>
        </span>
    );
}

const SUGGESTIONS = [
    "A modern SaaS landing page with pricing cards and testimonials",
    "A portfolio page with project gallery and animated hero section",
    "A coffee shop website with menu, about us, and contact section",
    "A todo app dashboard with sidebar navigation and dark theme",
];

export default function BuildPage() {
    const [prompt, setPrompt] = useState("");
    const [status, setStatus] = useState(STATUS.IDLE);
    const [previewUrl, setPreviewUrl] = useState("");
    const [sandboxId, setSandboxId] = useState("");
    const [error, setError] = useState("");
    const [logs, setLogs] = useState([]);
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
                    // ~6 minutes timeout (120 * 3s)
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

    return (
        <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
            {/* ─── Left Panel: Prompt & Controls ─── */}
            <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-[420px] min-w-[380px] flex flex-col border-r border-zinc-800/80 bg-zinc-950"
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800/80">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/20">
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold tracking-tight">
                            Ripple Builder
                        </h1>
                        <p className="text-[11px] text-zinc-500">
                            AI-powered website generator
                        </p>
                    </div>
                    <div className="ml-auto">
                        <StatusDot status={status} />
                    </div>
                </div>

                {/* Prompt Area */}
                <div className="flex-1 flex flex-col p-5 gap-4 overflow-y-auto">
                    <div>
                        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2 block">
                            Describe your website
                        </label>
                        <Textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g. Create a modern SaaS landing page with a hero section, feature cards, pricing table, and dark theme..."
                            className="min-h-[140px] bg-zinc-900/60 border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 resize-none focus:border-violet-600/50 focus:ring-1 focus:ring-violet-600/20 transition-all rounded-xl"
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
                                <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-2">
                                    Try a suggestion
                                </p>
                                <div className="flex flex-col gap-2">
                                    {SUGGESTIONS.map((s, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSuggestion(s)}
                                            className="text-left text-xs px-3 py-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800/80 hover:border-zinc-700 transition-all duration-200"
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
                        className="w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-violet-600/20 transition-all duration-300 disabled:opacity-40 disabled:shadow-none"
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
                            className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
                        >
                            {error}
                        </motion.div>
                    )}

                    {/* Logs */}
                    {logs.length > 0 && (
                        <div>
                            <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-2">
                                Build log
                            </p>
                            <div className="flex flex-col gap-1 bg-zinc-900/40 rounded-xl border border-zinc-800/50 p-3 max-h-[200px] overflow-y-auto">
                                {logs.map((log, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -5 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="text-[11px] font-mono text-zinc-400"
                                    >
                                        <span className="text-zinc-600">{log.time}</span>{" "}
                                        {log.message}
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-zinc-800/80 flex items-center gap-2 text-[11px] text-zinc-600">
                    <Code2 className="w-3 h-3" />
                    <span>Powered by Gemini + E2B Sandbox</span>
                </div>
            </motion.div>

            {/* ─── Right Panel: Preview ─── */}
            <div className="flex-1 flex flex-col bg-zinc-900/30">
                {/* Preview Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/80 bg-zinc-950/50 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <Eye className="w-4 h-4 text-zinc-500" />
                        <span className="text-xs font-medium text-zinc-400">Preview</span>
                        {previewUrl && (
                            <Badge
                                variant="outline"
                                className="text-[10px] border-emerald-600/30 text-emerald-400 bg-emerald-500/5"
                            >
                                Live
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {previewUrl && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => iframeRef.current?.contentWindow?.location.reload()}
                                    className="h-7 px-2 text-zinc-400 hover:text-white"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(previewUrl, "_blank")}
                                    className="h-7 px-2 text-zinc-400 hover:text-white"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
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
                                <div className="w-20 h-20 rounded-2xl bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center">
                                    <Sparkles className="w-8 h-8 text-zinc-600" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm text-zinc-500 font-medium">
                                        No preview yet
                                    </p>
                                    <p className="text-xs text-zinc-600 mt-1">
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
                                {/* Animated loading orb */}
                                <div className="relative">
                                    <motion.div
                                        animate={{
                                            scale: [1, 1.2, 1],
                                            opacity: [0.5, 1, 0.5],
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            ease: "easeInOut",
                                        }}
                                        className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-600/20 to-indigo-600/20 blur-xl absolute inset-0"
                                    />
                                    <div className="w-24 h-24 rounded-full border border-violet-600/20 flex items-center justify-center relative">
                                        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm text-zinc-300 font-medium">
                                        {status === STATUS.GENERATING
                                            ? "AI agents are crafting your website…"
                                            : "Starting the preview server…"}
                                    </p>
                                    <p className="text-xs text-zinc-600 mt-1">
                                        This can take 1–2 minutes
                                    </p>
                                </div>

                                {/* Skeleton preview hint */}
                                <div className="w-full max-w-lg px-8 mt-4 space-y-3 opacity-30">
                                    <Skeleton className="h-8 w-3/4 bg-zinc-800" />
                                    <Skeleton className="h-4 w-full bg-zinc-800" />
                                    <Skeleton className="h-4 w-5/6 bg-zinc-800" />
                                    <div className="flex gap-3 mt-4">
                                        <Skeleton className="h-24 flex-1 bg-zinc-800 rounded-xl" />
                                        <Skeleton className="h-24 flex-1 bg-zinc-800 rounded-xl" />
                                        <Skeleton className="h-24 flex-1 bg-zinc-800 rounded-xl" />
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
                                <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                    <Code2 className="w-8 h-8 text-red-400" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm text-red-400 font-medium">
                                        Build failed
                                    </p>
                                    <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                                        {error || "An unexpected error occurred"}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setStatus(STATUS.IDLE);
                                        setError("");
                                    }}
                                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                                >
                                    Try again
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
