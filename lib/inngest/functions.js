import { inngest } from "./client";
import { Sandbox } from "e2b";
import { setBuild } from "../../app/api/build/builds";
import { generateCustomiseJson } from "../GenerativeEngine/parser";
import { downloadFileFromSandbox, uploadFileToSandbox, deleteFileInSandbox } from "../GenerativeEngine/sandboxmanager";

const TEMPLATE_REPO = "https://github.com/Priyansh6747/RippleTemplates.git";
const APP_DIR = "/home/user/app";
const CUSTOMISE_PATH = `${APP_DIR}/customise.json`;

export const helloWorld = inngest.createFunction(
    { id: "hello-world", retries: 0 },
    { event: "test/hello" },

    async ({ event, step }) => {
        const eventId = event.id;

        try {
            // ── Step 1: Sandbox Creation ────────────────────────────────────
            // Boot a fresh default E2B sandbox (Node.js pre-installed).
            const sandboxId = await step.run("create-sandbox", async () => {
                const sandbox = await Sandbox.create({
                    apiKey: process.env.E2B_API_KEY,
                    timeout: 800_000,
                });
                return sandbox.sandboxId;
            });

            // ── Step 2: Scaffolding Structure ───────────────────────────────
            // Clean slate clone of RippleTemplates + dependency install.
            // Uses memory-capped npm to avoid OOM (exit 137) in E2B sandbox.
            await step.run("scaffolding-structure", async () => {
                const sandbox = await Sandbox.connect(sandboxId, {
                    apiKey: process.env.E2B_API_KEY,
                });

                // Verify Node/npm are available
                const nodeCheck = await sandbox.commands.run("node -v && npm -v", {
                    timeoutMs: 10_000,
                });
                console.log("[E2B] Node/npm:", nodeCheck.stdout.trim());

                // Clean up any previous attempt then clone fresh
                await sandbox.commands.run(`rm -rf ${APP_DIR}`, { timeoutMs: 15_000 });

                const clone = await sandbox.commands.run(
                    `git clone --depth 1 ${TEMPLATE_REPO} ${APP_DIR}`,
                    { timeoutMs: 60_000 }
                );
                if (clone.stderr && !clone.stderr.includes("Cloning into")) {
                    console.warn("[E2B] Clone stderr:", clone.stderr);
                }
                console.log("[E2B] Clone:", clone.stdout || "OK");

                // Install deps with memory cap to prevent OOM (exit 137).
                // --no-audit --no-fund reduce extra network + memory overhead.
                // NODE_OPTIONS caps the V8 heap to 512 MB.
                const npmCmd =
                    `cd ${APP_DIR} && ` +
                    `NODE_OPTIONS="--max-old-space-size=512" ` +
                    `npm install --no-audit --no-fund --prefer-offline 2>&1 | tail -30`;

                let installResult;
                try {
                    installResult = await sandbox.commands.run(npmCmd, {
                        timeoutMs: 240_000,
                    });
                    console.log("[E2B] Install output:", installResult.stdout?.slice(-500));
                } catch (err) {
                    // exit 137 = OOM-killed; log and continue — node_modules may be
                    // partially usable, and we will use npx next dev as a fallback.
                    if (err?.exitCode === 137 || err?.message?.includes("137")) {
                        console.warn("[E2B] npm install OOM-killed (exit 137). Proceeding with partial install.");
                    } else {
                        throw err;
                    }
                }

                // Confirm node_modules exist before continuing.
                const check = await sandbox.commands.run(
                    `[ -d ${APP_DIR}/node_modules ] && echo "ok" || echo "missing"`,
                    { timeoutMs: 5_000 }
                );
                console.log("[E2B] node_modules:", check.stdout?.trim());
            });

            // ── Step 3: File Sync (Download) ────────────────────────────────
            // Pull customise.json out of the sandbox for AI rewriting.
            const originalCustomiseJson = await step.run("sync-down", async () => {
                const sandbox = await Sandbox.connect(sandboxId, {
                    apiKey: process.env.E2B_API_KEY,
                });
                const content = await downloadFileFromSandbox(sandbox, CUSTOMISE_PATH);
                return JSON.parse(content);
            });

            // ── Step 4: Generation ──────────────────────────────────────────
            // Groq expands the idea → Gemini rewrites each section + colors.
            const newCustomiseJson = await step.run("generation", async () => {
                const idea = event.data?.idea || "A sleek modern SaaS platform";
                return await generateCustomiseJson(originalCustomiseJson, idea);
            });

            // ── Step 5: File Sync (Upload) ──────────────────────────────────
            // Swap in the AI-generated customise.json.
            await step.run("sync-up", async () => {
                const sandbox = await Sandbox.connect(sandboxId, {
                    apiKey: process.env.E2B_API_KEY,
                });
                await deleteFileInSandbox(sandbox, CUSTOMISE_PATH);
                await uploadFileToSandbox(
                    sandbox,
                    CUSTOMISE_PATH,
                    JSON.stringify(newCustomiseJson, null, 2)
                );
            });

            // ── Step 6: Finalisation ────────────────────────────────────────
            // Start the dev server (memory-capped), then poll until live.
            const sandboxURL = await step.run("finalisation", async () => {
                const sandbox = await Sandbox.connect(sandboxId, {
                    apiKey: process.env.E2B_API_KEY,
                });

                // Start dev server in the background using the E2B SDK's native feature.
                await sandbox.commands.run(
                    `cd ${APP_DIR} && nohup npm run dev > /tmp/app.log 2>&1 &`,
                    { background: true }
                );

                console.log("[E2B] Dev server launched — polling for readiness …");

                // Poll for up to 120s (24 × 5s). Check BOTH the log for Next.js
                // ready signals AND an actual HTTP response from localhost:3000.
                const READY_SIGNALS = [
                    "ready", "Ready", "started server", "Local:",
                    "localhost", "listening", "✓ Ready",
                ];

                let isReady = false;
                for (let i = 0; i < 24; i++) {
                    await new Promise((r) => setTimeout(r, 5_000));

                    // 1. Check log for ready signals
                    const logResult = await sandbox.commands
                        .run("cat /tmp/app.log 2>/dev/null || echo ''", { timeoutMs: 5_000 })
                        .catch(() => ({ stdout: "" }));
                    const output = logResult.stdout || "";
                    console.log(`[E2B] [poll ${i + 1}/24] log tail:`, output.slice(-200));

                    if (READY_SIGNALS.some((sig) => output.includes(sig))) {
                        console.log("[E2B] Ready signal found in log.");
                        isReady = true;
                        break;
                    }

                    // 2. Fallback: direct HTTP health check on port 3000
                    const curlResult = await sandbox.commands
                        .run(
                            `curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000`,
                            { timeoutMs: 8_000 }
                        )
                        .catch(() => ({ stdout: "0" }));
                    const httpCode = parseInt(curlResult.stdout?.trim() || "0", 10);
                    console.log(`[E2B] [poll ${i + 1}/24] HTTP status: ${httpCode}`);

                    if (httpCode > 0) {
                        console.log("[E2B] HTTP health check passed.");
                        isReady = true;
                        break;
                    }
                }

                if (!isReady) {
                    const finalLog = await sandbox.commands
                        .run("cat /tmp/app.log 2>/dev/null || echo 'no log'", { timeoutMs: 5_000 })
                        .catch(() => ({ stdout: "" }));
                    console.error("[E2B] Final app.log:\n", finalLog.stdout);

                    const ps = await sandbox.commands
                        .run("ps aux | grep node", { timeoutMs: 5_000 })
                        .catch(() => ({ stdout: "" }));
                    console.error("[E2B] Node processes:\n", ps.stdout);

                    throw new Error("Dev server failed to start on port 3000.");
                }

                const host = sandbox.getHost(3000);
                return `https://${host}`;
            });

            // Persist result for client polling
            setBuild(eventId, {
                sandboxId,
                url: sandboxURL,
                status: "ready",
            });

            return {
                message: "GenerativeEngine pipeline complete — sandbox is live",
                sandboxId,
                url: sandboxURL,
            };
        } catch (err) {
            setBuild(eventId, {
                status: "error",
                error: err.message || "GenerativeEngine pipeline failed",
            });
            throw err;
        }
    }
);