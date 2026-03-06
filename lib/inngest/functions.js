import { inngest } from "./client";
import { gemini, createAgent } from "@inngest/agent-kit";
import { Sandbox } from "e2b";

export const helloWorld = inngest.createFunction(
    { id: "hello-world" },
    { event: "test/hello" },

    async ({ step }) => {

        const sandboxId = await step.run("create-sandbox", async () => {
            const sandbox = await Sandbox.create("zngf8ek7qzav6qfym02k", {
                apiKey: process.env.E2B_API_KEY,
                timeout: 120_000,
            });

            return sandbox.sandboxId;
        });

        /* const output = await step.run("run-agent", async () => {
             const agent = createAgent({
                 name: "MyAgent",
                 description: "test agent",
                 system: "say hello",
                 model: gemini({ model: "gemini-3-flash-preview" }),
             });
 
             const result = await agent.run("say hi max");
             return result.output[0].content ?? "";
         });*/

        const sandboxURI = await step.run("get-sandbox-url", async () => {
            const sandbox = await Sandbox.connect(sandboxId, {
                apiKey: process.env.E2B_API_KEY,
            });

            // Wait for the Next.js dev server to be ready (start_cmd runs /compile_page.sh)
            const maxRetries = 30;
            for (let i = 0; i < maxRetries; i++) {
                try {
                    const result = await sandbox.commands.run("nc -z localhost 3000", { timeout: 2000 });
                    if (result.exitCode === 0) break;
                } catch { /* server not ready yet */ }
                await new Promise((r) => setTimeout(r, 2000));
            }

            const host = sandbox.getHost(3000);
            return `https://${host}`;
        });

        return {
            //message: output,
            sandbox: sandboxURI,
        };
    }
);