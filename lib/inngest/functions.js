import { inngest } from "./client";
import { Sandbox } from "@e2b/code-interpreter";
import { setBuild } from "../../app/api/build/builds";
import { generateCustomiseJson, generateBasicNextFiles, selectTemplate, BASIC_NEXT_FILES } from "../GenerativeEngine/parser";
import { downloadFileFromSandbox, uploadFileToSandbox } from "../GenerativeEngine/sandboxmanager";

const APP_DIR = "/home/user/app";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: run Python code in sandbox (used by both branches)
// This is the reliable way to background a process in e2b — subprocess.Popen
// inside the Python kernel outlives the command handle, unlike commands.run
// with background:true which dies when the handle goes out of scope.
// ─────────────────────────────────────────────────────────────────────────────

async function py(sandbox, code) {
    const result = await sandbox.runCode(code, { timeoutMs: 300_000 });
    const stdout = result.logs.stdout.join("").trim();
    const stderr = result.logs.stderr.join("").trim();
    if (result.error) {
        throw new Error(`[E2B Python error] ${result.error.value}\n${result.error.traceback}`);
    }
    if (stderr) console.warn("[E2B stderr]", stderr);
    return stdout;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: run a one-shot shell command via Python subprocess (non-background)
// Safer than sandbox.commands.run for commands with cwd/env requirements.
// ─────────────────────────────────────────────────────────────────────────────

async function sh(sandbox, cmd, { cwd = APP_DIR, timeoutSecs = 120, env = {} } = {}) {
    const envStr = Object.entries(env)
        .map(([k, v]) => `"${k}": "${v}"`)
        .join(", ");

    return await py(sandbox, `
import subprocess, os
r = subprocess.run(
    ${JSON.stringify(cmd)},
    shell=True,
    capture_output=True,
    text=True,
    cwd=${JSON.stringify(cwd)},
    timeout=${timeoutSecs},
    env={**os.environ, ${envStr}}
)
print(r.stdout or "")
if r.returncode != 0:
    raise Exception(f"Command failed (exit {r.returncode}):\\n" + (r.stdout[-800:] or r.stderr[-800:]))
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: launch a background server via Python Popen and poll until ready.
// Popen keeps the process alive inside the Python kernel independently of any
// e2b command handle — this is why the old commit worked and background:true
// did not.
// ─────────────────────────────────────────────────────────────────────────────

async function launchAndWait(sandbox, { cmd, cwd = APP_DIR, env = {}, logFile, label = "" }) {
    const envStr = Object.entries({ NODE_OPTIONS: "--max-old-space-size=512", ...env })
        .map(([k, v]) => `"${k}": "${v}"`)
        .join(", ");

    const launchOut = await py(sandbox, `
import subprocess, os, time
proc = subprocess.Popen(
    ${JSON.stringify(cmd)},
    cwd=${JSON.stringify(cwd)},
    stdout=open(${JSON.stringify(logFile)}, "w"),
    stderr=subprocess.STDOUT,
    env={**os.environ, ${envStr}}
)
print(f"PID: {proc.pid}")
time.sleep(3)
print(f"Still running: {proc.poll() is None}")
`);
    console.log(`${label} Server launch:`, launchOut);

    // 15s grace period for Next.js to begin booting
    await new Promise(r => setTimeout(r, 15_000));

    const READY_SIGNALS = ["ready", "Ready", "started server", "Local:", "localhost", "listening", "✓ Ready"];

    for (let i = 0; i < 30; i++) {
        const log = await py(sandbox, `
try:
    print(open(${JSON.stringify(logFile)}).read()[-600:])
except:
    print("")
`);
        console.log(`${label} [poll ${i + 1}/30]:`, log.slice(-200));

        if (READY_SIGNALS.some(sig => log.includes(sig))) {
            console.log(`${label} Ready signal found.`);
            return;
        }

        const httpCode = await py(sandbox, `
import urllib.request
try:
    r = urllib.request.urlopen("http://localhost:3000", timeout=3)
    print(r.status)
except:
    print(0)
`);
        console.log(`${label} HTTP: ${httpCode}`);
        if (parseInt(httpCode || "0") > 0) {
            console.log(`${label} HTTP health check passed.`);
            return;
        }

        await new Promise(r => setTimeout(r, 5_000));
    }

    // Dump diagnostics before throwing
    const diag = await py(sandbox, `
import subprocess, os
log = open(${JSON.stringify(logFile)}).read() if os.path.exists(${JSON.stringify(logFile)}) else "no log"
ps = subprocess.run("ps aux | grep node", shell=True, capture_output=True, text=True).stdout
port = subprocess.run("ss -tlnp | grep 3000 || echo 'port not bound'", shell=True, capture_output=True, text=True).stdout
print("=== LOG ==="); print(log[-1000:])
print("=== PS ==="); print(ps)
print("=== PORT ==="); print(port)
`);
    console.error(`${label} Diagnostics:\n`, diag);
    throw new Error(`${label} Server failed to start on port 3000 within 150s.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Inngest Function
// ─────────────────────────────────────────────────────────────────────────────

export const helloWorld = inngest.createFunction(
    { id: "hello-world", retries: 0 },
    { event: "test/hello" },

    async ({ event, step }) => {
        console.log("🔍 event.data:", JSON.stringify(event.data));

        const idea = event.data?.prompt?.trim();
        if (!idea) {
            throw new Error(
                "Missing required field: event.data.prompt\n" +
                'Send the event as: { name: "test/hello", data: { prompt: "your idea here" } }'
            );
        }
        console.log("✅ Idea received:", idea);

        const eventId = event.id;

        try {
            // ── Step 1: Problem Analysis & Template Selection ───────────────
            const template = await step.run("Problem-analysis", async () => {
                return await selectTemplate(idea);
            });

            console.log(`✅ Template: ${template.id} → ${template.url}`);

            // ══════════════════════════════════════════════════════════════════
            // BRANCH A — BasicNext (simple / portfolio / brochure sites)
            // ══════════════════════════════════════════════════════════════════
            if (template.id === "basicnext") {

                // ── Step 2: Create Sandbox & Scaffold ─────────────────────────
                const sandboxId = await step.run("create-and-scaffold", async () => {
                    const sb = await Sandbox.create({
                        apiKey: process.env.E2B_API_KEY,
                        timeout: 800_000,
                        requestTimeoutMs: 60_000,
                    });

                    const nodeVersion = await py(sb, `
import subprocess
r = subprocess.run("node -v && npm -v", shell=True, capture_output=True, text=True)
print(r.stdout.strip())
`);
                    console.log("[BasicNext] Node/npm:", nodeVersion);

                    const cloneOut = await py(sb, `
import subprocess
subprocess.run("rm -rf ${APP_DIR}", shell=True)
r = subprocess.run(
    "git clone --depth 1 ${template.url} ${APP_DIR}",
    shell=True, capture_output=True, text=True, timeout=120
)
print(r.stdout or "cloned")
if r.returncode != 0:
    raise Exception("Clone failed: " + r.stderr)
`);
                    console.log("[BasicNext] Clone:", cloneOut);

                    const installOut = await py(sb, `
import subprocess, os
cmd = "npm ci" if os.path.exists("${APP_DIR}/package-lock.json") else "npm install"
r = subprocess.run(
    f"cd ${APP_DIR} && {cmd} 2>&1 | tail -30",
    shell=True, capture_output=True, text=True, timeout=300
)
print(r.stdout[-500:] if r.stdout else r.stderr)
if r.returncode != 0:
    raise Exception("Install failed: " + r.stdout[-300:])
`);
                    console.log("[BasicNext] Install:", installOut.slice(-300));

                    return sb.sandboxId;
                });

                // ── Step 3: Sync Down ─────────────────────────────────────────
                const originalFiles = await step.run("sync-down", async () => {
                    const sb = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });
                    const files = {};
                    for (const relPath of BASIC_NEXT_FILES) {
                        try {
                            files[relPath] = await downloadFileFromSandbox(sb, `${APP_DIR}/${relPath}`);
                            console.log(`[BasicNext] Read ${relPath} (${files[relPath].length} chars)`);
                        } catch (err) {
                            console.warn(`[BasicNext] Could not read ${relPath}:`, err.message);
                            files[relPath] = "";
                        }
                    }
                    return files;
                });

                // ── Step 4: Generation ────────────────────────────────────────
                const generatedFiles = await step.run("generation", async () => {
                    console.log("[BasicNext] Generating files in parallel …");
                    return await generateBasicNextFiles(originalFiles, idea);
                });

                // ── Step 5: Sync Up ───────────────────────────────────────────
                await step.run("sync-up", async () => {
                    const sb = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });
                    await Promise.all(
                        Object.entries(generatedFiles).map(([relPath, content]) =>
                            uploadFileToSandbox(sb, `${APP_DIR}/${relPath}`, content)
                        )
                    );
                    console.log(`[BasicNext] Wrote ${Object.keys(generatedFiles).length} files.`);
                    return `Wrote: ${Object.keys(generatedFiles).join(", ")}`;
                });

                // ── Step 6: Finalisation ──────────────────────────────────────
                const sandboxURL = await step.run("finalisation", async () => {
                    const sb = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });

                    // Build first (one-shot, not backgrounded)
                    console.log("[BasicNext] Building …");
                    const buildOut = await sh(sb, "npm run build", {
                        cwd: APP_DIR,
                        timeoutSecs: 180,
                        env: { NODE_OPTIONS: "--max-old-space-size=512" },
                    });
                    console.log("[BasicNext] Build output (tail):", buildOut.slice(-500));

                    // Launch production server via Popen — keeps process alive
                    await launchAndWait(sb, {
                        cmd: ["npm", "run", "start"],
                        cwd: APP_DIR,
                        env: { PORT: "3000", NODE_OPTIONS: "--max-old-space-size=512" },
                        logFile: "/tmp/basicnext.log",
                        label: "[BasicNext]",
                    });

                    return `https://${sb.getHost(3000)}`;
                });

                setBuild(eventId, { sandboxId, url: sandboxURL, status: "ready" });
                console.log("[BasicNext] Pipeline complete:", sandboxURL);

                return {
                    message: "BasicNext pipeline complete — sandbox is live",
                    template: "basicnext",
                    sandboxId,
                    url: sandboxURL,
                };
            }

            // ══════════════════════════════════════════════════════════════════
            // BRANCH B — Ripple / Nexus (customise.json flow)
            // ══════════════════════════════════════════════════════════════════

            const templateRepo = template.url;

            // ── Step 2: Sandbox Creation & Scaffolding ────────────────────────
            const sandboxId = await step.run("create-and-scaffold", async () => {
                const sandbox = await Sandbox.create({
                    apiKey: process.env.E2B_API_KEY,
                    timeout: 1200_000,
                    requestTimeoutMs: 60_000,
                });

                const nodeVersion = await py(sandbox, `
import subprocess
r = subprocess.run("node -v && npm -v", shell=True, capture_output=True, text=True)
print(r.stdout.strip())
`);
                console.log("[E2B] Node/npm:", nodeVersion);

                const cloneOut = await py(sandbox, `
import subprocess
subprocess.run("rm -rf ${APP_DIR}", shell=True)
r = subprocess.run(
    "git clone --depth 1 ${templateRepo} ${APP_DIR}",
    shell=True, capture_output=True, text=True, timeout=120
)
print(r.stdout or "cloned")
if r.returncode != 0:
    raise Exception("Clone failed: " + r.stderr)
`);
                console.log("[E2B] Clone:", cloneOut);

                const installOut = await py(sandbox, `
import subprocess, os
cmd = "npm ci" if os.path.exists("${APP_DIR}/package-lock.json") else "npm install"
r = subprocess.run(
    f"cd ${APP_DIR} && {cmd} 2>&1 | tail -30",
    shell=True, capture_output=True, text=True, timeout=300
)
print(r.stdout[-500:] if r.stdout else r.stderr)
if r.returncode != 0:
    raise Exception("Install failed: " + r.stdout[-300:])
`);
                console.log("[E2B] Install:", installOut.slice(-300));

                return sandbox.sandboxId;
            });

            // ── Step 3: Sync Down ─────────────────────────────────────────────
            const CUSTOMISE_PATH = `${APP_DIR}/customise.json`;
            const originalCustomiseJson = await step.run("sync-down", async () => {
                const sandbox = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });
                const content = await downloadFileFromSandbox(sandbox, CUSTOMISE_PATH);
                return JSON.parse(content);
            });

            // ── Step 4: Generation ────────────────────────────────────────────
            const newCustomiseJson = await step.run("generation", async () => {
                console.log("⟳ Generation step — using idea:", idea);
                return await generateCustomiseJson(originalCustomiseJson, idea);
            });

            // ── Step 5: Sync Up ───────────────────────────────────────────────
            await step.run("sync-up", async () => {
                const sandbox = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });
                await uploadFileToSandbox(
                    sandbox,
                    CUSTOMISE_PATH,
                    JSON.stringify(newCustomiseJson, null, 2)
                );
            });

            // ── Step 6: Finalisation ──────────────────────────────────────────
            const sandboxURL = await step.run("finalisation", async () => {
                const sandbox = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });

                // Launch dev server via Python Popen — same pattern as working commit
                await launchAndWait(sandbox, {
                    cmd: ["npm", "run", "dev"],
                    cwd: APP_DIR,
                    env: { NODE_OPTIONS: "--max-old-space-size=512" },
                    logFile: "/tmp/app.log",
                    label: "[E2B]",
                });

                return `https://${sandbox.getHost(3000)}`;
            });

            setBuild(eventId, { sandboxId, url: sandboxURL, status: "ready" });

            return {
                message: "GenerativeEngine pipeline complete — sandbox is live",
                template: template.id,
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