import { inngest } from "./client";
import { gemini, createAgent } from "@inngest/agent-kit";
import { Sandbox } from "@e2b/sdk";

export const helloWorld = inngest.createFunction(
    { id: "hello-world" },
    { event: "test/hello" },

    async ({ step }) => {

        const sandboxId = await step.run("create-sandbox", async () => {
            const sandbox = await Sandbox.create("zngf8ek7qzav6qfym02k", {
                apiKey: process.env.E2B_API_KEY,
            });
            return sandbox.sandboxId;
        });

        const output = await step.run("run-agent", async () => {
            const agent = createAgent({
                name: "MyAgent",
                description: "test agent",
                system: "say hello",
                model: gemini({ model: "gemini-3.1-flash-lite-preview" }),
            });

            const result = await agent.run("say hi max");
            return result.output[0].content ?? "";
        });

        const sandboxURI = await step.run("get-sandbox-url", async () => {
            const sandbox = await Sandbox.connect(sandboxId);
            const host = sandbox.getHost(3000);
            return `http://${host}`;
        });

        return {
            message: output,
            sandbox: sandboxURI,
        };
    }
);