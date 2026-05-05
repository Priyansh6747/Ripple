import { inngest } from "./client";
import { Sandbox } from "@e2b/code-interpreter";
import { setBuild } from "../../app/api/build/builds";

const TEMPLATE_REPO = "https://github.com/Priyansh6747/RippleTemplates.git";
const APP_DIR = "/home/user/app";

// Helper: run Python code in sandbox and return stdout text
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

export const helloWorld = inngest.createFunction(
    { id: "hello-world", retries: 0 },
    { event: "test/hello" },

    async ({ event, step }) => {
        const eventId = event.id;

        try {
            // ── Step 1: Sandbox Creation ────────────────────────────────────
            const sandboxId = await step.run("create-sandbox", async () => {
                const sandbox = await Sandbox.create({
                    apiKey: process.env.E2B_API_KEY,
                    timeout: 800_000,
                });
                return sandbox.sandboxId;
            });

            // ── Step 2: Scaffolding Structure ───────────────────────────────
            await step.run("scaffolding-structure", async () => {
                const sandbox = await Sandbox.connect(sandboxId, {
                    apiKey: process.env.E2B_API_KEY,
                });

                // Verify Node/npm
                const nodeVersion = await py(sandbox, `
import subprocess
r = subprocess.run("node -v && npm -v", shell=True, capture_output=True, text=True)
print(r.stdout.strip())
`);
                console.log("[E2B] Node/npm:", nodeVersion);

                // Clean + clone
                const cloneOut = await py(sandbox, `
import subprocess
subprocess.run("rm -rf ${APP_DIR}", shell=True)
r = subprocess.run(
    "git clone --depth 1 ${TEMPLATE_REPO} ${APP_DIR}",
    shell=True, capture_output=True, text=True, timeout=60
)
print(r.stdout or "cloned")
if r.returncode != 0:
    print("STDERR:", r.stderr)
`);
                console.log("[E2B] Clone:", cloneOut);

                // Install deps (npm ci if lockfile exists, else npm install)
                const installOut = await py(sandbox, `
import subprocess, os
cmd = "npm ci" if os.path.exists("${APP_DIR}/package-lock.json") else "npm install"
r = subprocess.run(
    f"cd ${APP_DIR} && {cmd} 2>&1 | tail -30",
    shell=True, capture_output=True, text=True, timeout=240
)
print(r.stdout[-500:] if r.stdout else r.stderr)
`);
                console.log("[E2B] Install:", installOut.slice(-300));

                // Verify node_modules
                const check = await py(sandbox, `
import os
print("ok" if os.path.isdir("${APP_DIR}/node_modules") else "missing")
`);
                console.log("[E2B] node_modules:", check);
            });

            // ── Step 3: Finalisation ────────────────────────────────────────
            const sandboxURL = await step.run("finalisation", async () => {
                const sandbox = await Sandbox.connect(sandboxId, {
                    apiKey: process.env.E2B_API_KEY,
                });

                // Launch dev server via Python Popen — reliable backgrounding
                const launchOut = await py(sandbox, `
import subprocess, os, time
proc = subprocess.Popen(
    ["npm", "run", "dev"],
    cwd="${APP_DIR}",
    stdout=open("/tmp/app.log", "w"),
    stderr=subprocess.STDOUT,
    env={**os.environ, "NODE_OPTIONS": "--max-old-space-size=512"}
)
print(f"PID: {proc.pid}")
time.sleep(3)
print(f"Still running: {proc.poll() is None}")
`);
                console.log("[E2B] Server launch:", launchOut);

                // 15s initial grace period for Next.js to begin booting
                await new Promise((r) => setTimeout(r, 15_000));

                const READY_SIGNALS = ["ready", "Ready", "started server", "Local:", "localhost", "listening", "✓ Ready"];

                let isReady = false;
                for (let i = 0; i < 30; i++) {
                    // Check log
                    const log = await py(sandbox, `
try:
    f = open("/tmp/app.log")
    print(f.read()[-600:])
except:
    print("")
`);
                    console.log(`[E2B] [poll ${i + 1}/30]:`, log.slice(-200));

                    if (READY_SIGNALS.some((sig) => log.includes(sig))) {
                        console.log("[E2B] Ready signal found.");
                        isReady = true;
                        break;
                    }

                    // HTTP health check
                    const httpCode = await py(sandbox, `
import urllib.request
try:
    r = urllib.request.urlopen("http://localhost:3000", timeout=3)
    print(r.status)
except:
    print(0)
`);
                    console.log(`[E2B] HTTP: ${httpCode}`);
                    if (parseInt(httpCode || "0") > 0) {
                        isReady = true;
                        break;
                    }

                    await new Promise((r) => setTimeout(r, 5_000));
                }

                if (!isReady) {
                    const diag = await py(sandbox, `
import subprocess, os
log = open("/tmp/app.log").read() if os.path.exists("/tmp/app.log") else "no log"
ps = subprocess.run("ps aux | grep node", shell=True, capture_output=True, text=True).stdout
port = subprocess.run("ss -tlnp | grep 3000 || echo 'port not bound'", shell=True, capture_output=True, text=True).stdout
print("=== LOG ==="); print(log[-1000:])
print("=== PS ==="); print(ps)
print("=== PORT ==="); print(port)
`);
                    console.error("[E2B] Diagnostics:\n", diag);
                    throw new Error("Dev server failed to start on port 3000.");
                }

                const host = sandbox.getHost(3000);
                return `https://${host}`;
            });

            setBuild(eventId, { sandboxId, url: sandboxURL, status: "ready" });

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