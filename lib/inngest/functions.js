import { inngest } from "./client";
import { Sandbox } from "e2b";
import { setBuild } from "../../app/api/build/builds";

export const helloWorld = inngest.createFunction(
    { id: "hello-world", retries: 0 },
    { event: "test/hello" },

    async ({ event, step }) => {
        const eventId = event.id;

        try {
            // Step 1: Create sandbox from the template
            const sandboxId = await step.run("create-sandbox", async () => {
                const sandbox = await Sandbox.create("gh2iseh7j01hlstd5g54", {
                    apiKey: process.env.E2B_API_KEY,
                    timeout: 300_000,
                });
                return sandbox.sandboxId;
            });

            // Step 2: Start dev server and wait for it
            const sandboxURL = await step.run("wait-for-server", async () => {
                const sandbox = await Sandbox.connect(sandboxId, {
                    apiKey: process.env.E2B_API_KEY,
                });

                // Start dev server, pipe logs to file so we can debug if needed
                await sandbox.commands.run(
                    "npm run dev > /tmp/nextjs.log 2>&1",
                    { background: true, cwd: "/home/user/app" }
                );

                // Wait for Next.js to actually serve HTTP (curl is more reliable than nc)
                let isReady = false;
                for (let i = 0; i < 90; i++) {
                    try {
                        const result = await sandbox.commands.run(
                            `curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:3000`,
                            { timeout: 4_000 }
                        );
                        const code = parseInt(result.stdout.trim(), 10);
                        if (code > 0) {
                            isReady = true;
                            break;
                        }
                    } catch {
                        /* not ready yet */
                    }
                    await new Promise((r) => setTimeout(r, 2_000));
                }

                if (!isReady) {
                    // Dump Next.js logs so we know exactly why it failed
                    const log = await sandbox.commands.run("cat /tmp/nextjs.log");
                    console.error("[E2B] Next.js failed to start:\n", log.stdout);
                    throw new Error("Next.js dev server failed to start on port 3000.");
                }

                const host = sandbox.getHost(3000);
                return `https://${host}`;
            });

            // Step 3: Store result for client polling
            setBuild(eventId, {
                sandboxId,
                url: sandboxURL,
                status: "ready",
            });

            return {
                message: "Template sandbox is live",
                sandboxId,
                url: sandboxURL,
            };
        } catch (err) {
            setBuild(eventId, {
                status: "error",
                error: err.message || "Failed to boot sandbox",
            });
            throw err;
        }
    }
);