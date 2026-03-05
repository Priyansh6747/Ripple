import { inngest } from "./client";
import { gemini, createAgent } from "@inngest/agent-kit";

export const helloWorld = inngest.createFunction(
    { id: "hello-world" },
    { event: "test/hello" },
    async ({ event, step }) => {
        const myAgent = createAgent({
            name: "MyAgent",
            description:"idk something",
            system: "say something",
            model: gemini({model:"gemini-2.5-flash"})
        })

        const {output} = await myAgent.run("say hi max");

        return {
            message: output[0].content
        }
    },
);