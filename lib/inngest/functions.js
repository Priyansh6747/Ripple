import { inngest } from "./client";
import {
    gemini,
    createAgent,
    createNetwork,
    createTool,
} from "@inngest/agent-kit";
import { Sandbox } from "e2b";
import { z } from "zod";

// ─── E2B Sandbox Tools ──────────────────────────────────────────────────────

const createSandboxTools = (sandboxId) => {
    const getSandbox = () =>
        Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });

    const writeFile = createTool({
        name: "write_file",
        description:
            "Write content to a file in the Next.js sandbox project. The project root is /home/user/app. Use paths relative to the project root like src/app/page.tsx, src/app/globals.css, src/components/MyComponent.tsx etc.",
        parameters: z.object({
            path: z
                .string()
                .describe(
                    "File path relative to /home/user/app, e.g. src/app/page.tsx"
                ),
            content: z.string().describe("The full file content to write"),
        }),
        handler: async ({ path, content }) => {
            const sandbox = await getSandbox();
            await sandbox.files.write(`/home/user/app/${path}`, content);
            return `File written: ${path}`;
        },
    });

    const readFile = createTool({
        name: "read_file",
        description:
            "Read a file from the sandbox Next.js project. The project root is /home/user/app.",
        parameters: z.object({
            path: z
                .string()
                .describe(
                    "File path relative to /home/user/app, e.g. src/app/layout.tsx"
                ),
        }),
        handler: async ({ path }) => {
            const sandbox = await getSandbox();
            const content = await sandbox.files.read(`/home/user/app/${path}`);
            return content;
        },
    });

    const runCommand = createTool({
        name: "run_command",
        description:
            "Run a shell command in the sandbox. Working directory is /home/user/app. Use this for installing additional npm packages or running build commands.",
        parameters: z.object({
            command: z.string().describe("The shell command to execute"),
        }),
        handler: async ({ command }) => {
            const sandbox = await getSandbox();
            const result = await sandbox.commands.run(command, {
                cwd: "/home/user/app",
                timeout: 60_000,
            });
            return `exit: ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`;
        },
    });

    return { writeFile, readFile, runCommand };
};

// ─── Plan & Done Tools ──────────────────────────────────────────────────────

const savePlan = createTool({
    name: "save_plan",
    description:
        "Save the UI plan to the shared network state. Call this tool once you have a complete plan.",
    parameters: z.object({
        components: z
            .array(z.string())
            .describe(
                "List of shadcn component names to use, e.g. ['Button', 'Card', 'Input']"
            ),
        layout: z
            .string()
            .describe(
                "Overall layout description – sections, colors, animations, responsive behavior"
            ),
        files: z
            .array(
                z.object({
                    path: z
                        .string()
                        .describe("File path relative to project root, e.g. src/app/page.tsx"),
                    purpose: z.string().describe("What this file does"),
                })
            )
            .describe("List of files to create or modify"),
        useFramerMotion: z
            .boolean()
            .describe("Whether to use framer-motion animations"),
    }),
    handler: async (input, { network }) => {
        network?.state.kv.set("plan", input);
        return "Plan saved! The coder agent will now implement it.";
    },
});

const markDone = createTool({
    name: "mark_done",
    description:
        "Mark the coding task as complete. Call this ONLY after ALL files have been written.",
    parameters: z.object({
        summary: z.string().describe("Brief summary of what was built"),
    }),
    handler: async ({ summary }, { network }) => {
        network?.state.kv.set("done", true);
        network?.state.kv.set("summary", summary);
        return "Done!";
    },
});

// ─── Agent Definitions ──────────────────────────────────────────────────────

const createPlannerAgent = () =>
    createAgent({
        name: "ui_planner",
        description:
            "Plans the UI structure, component choices, and layout for a Next.js website.",
        system: `You are an expert UI/UX planner for Next.js websites.

Given a user's description, create a detailed plan for a beautiful, modern website.

IMPORTANT CONTEXT about the sandbox environment:
- The project uses Next.js 16 with TypeScript, App Router, and src/ directory
- Tailwind CSS v4 is installed and configured
- ALL shadcn/ui components are pre-installed (Button, Card, Input, Textarea, Dialog, Sheet, Tabs, Badge, Avatar, Separator, Skeleton, etc.)
- framer-motion is installed for animations
- lucide-react is installed for icons
- The entry page is at src/app/page.tsx and layout at src/app/layout.tsx
- Import shadcn components from "@/components/ui/..." (e.g. import { Button } from "@/components/ui/button")
- Import framer-motion as: import { motion } from "framer-motion"
- Import lucide icons as: import { IconName } from "lucide-react"
- Use "use client" directive for any component using hooks or framer-motion

Your plan should be PREMIUM and VISUALLY STUNNING:
- Use modern design with gradients, glassmorphism, subtle shadows
- Plan responsive layouts
- Include micro-animations with framer-motion
- Use a cohesive color palette via Tailwind

After analyzing the request, call the save_plan tool with your complete plan.`,
        tools: [savePlan],
    });

const createCoderAgent = (sandboxTools) =>
    createAgent({
        name: "coder",
        description:
            "Writes production-quality Next.js + TypeScript code into the sandbox.",
        system: ({ network }) => {
            const plan = network?.state.kv.get("plan");
            return `You are an expert Next.js / React / TypeScript developer.

You have a plan to implement. Here is the plan:
${JSON.stringify(plan, null, 2)}

IMPORTANT RULES:
1. Write ALL files specified in the plan using the write_file tool
2. Use TypeScript (.tsx / .ts files)
3. Import shadcn components from "@/components/ui/<component>" (e.g. import { Button } from "@/components/ui/button")
4. Import framer-motion: import { motion, AnimatePresence } from "framer-motion"
5. Import lucide-react icons: import { Icon } from "lucide-react"
6. Always add "use client" directive for components using hooks, event handlers, or framer-motion
7. Write COMPLETE file contents – never use placeholders like "// rest of code here"
8. Make the design STUNNING – use Tailwind classes for gradients, shadows, rounded corners, spacing
9. Use proper semantic HTML
10. Ensure the page is responsive (mobile-first with sm:, md:, lg: breakpoints)
11. The main page MUST be at src/app/page.tsx
12. You can optionally update src/app/globals.css for custom CSS variables or animations
13. After writing ALL files, call the mark_done tool

DO NOT install packages – everything you need is already installed.
Write each file one at a time using the write_file tool, then call mark_done when finished.`;
        },
        tools: [sandboxTools.writeFile, sandboxTools.readFile, sandboxTools.runCommand, markDone],
    });

// ─── Inngest Function ───────────────────────────────────────────────────────

export const helloWorld = inngest.createFunction(
    { id: "hello-world", retries: 0 },
    { event: "test/hello" },

    async ({ event, step }) => {
        const prompt = event.data?.prompt || "Create a beautiful landing page";

        // Step 1: Create sandbox
        const sandboxId = await step.run("create-sandbox", async () => {
            const sandbox = await Sandbox.create("zngf8ek7qzav6qfym02k", {
                apiKey: process.env.E2B_API_KEY,
                timeout: 300_000,
            });
            return sandbox.sandboxId;
        });

        // Step 2: Run the agent network
        const sandboxTools = createSandboxTools(sandboxId);
        const plannerAgent = createPlannerAgent();
        const coderAgent = createCoderAgent(sandboxTools);

        const network = createNetwork({
            name: "website-builder",
            agents: [plannerAgent, coderAgent],
            defaultModel: gemini({
                model: "gemini-2.5-flash",
            }),
            maxIter: 20,
            router: ({ network }) => {
                if (!network?.state.kv.has("plan")) {
                    return plannerAgent;
                }
                if (!network?.state.kv.get("done")) {
                    return coderAgent;
                }
                return undefined;
            },
        });

        const result = await network.run(prompt);
        const agentSummary = result?.state?.kv?.get("summary") ?? "Website built";

        // Step 3: Wait for dev server and get URL
        const sandboxURL = await step.run("get-sandbox-url", async () => {
            const sandbox = await Sandbox.connect(sandboxId, {
                apiKey: process.env.E2B_API_KEY,
            });

            // Wait for Next.js dev server to be ready
            const maxRetries = 60;
            for (let i = 0; i < maxRetries; i++) {
                try {
                    const result = await sandbox.commands.run("nc -z localhost 3000", {
                        timeout: 2000,
                    });
                    if (result.exitCode === 0) break;
                } catch {
                    /* server not ready yet */
                }
                await new Promise((r) => setTimeout(r, 2000));
            }

            const host = sandbox.getHost(3000);
            return `https://${host}`;
        });

        return {
            message: agentSummary,
            sandboxId,
            url: sandboxURL,
        };
    }
);

// ─── Simple Gemini Test Function ────────────────────────────────────────────

export const geminiTest = inngest.createFunction(
    { id: "gemini-test", retries: 0 },
    { event: "test/gemini" },

    async ({ event, step }) => {
        const myAgent = createAgent({
            name: "test-agent",
            description: "A simple test agent",
            system: "You are a helpful assistant. Keep responses short.",
            model: gemini({ model: "gemini-2.5-flash" }),
        });

        const { output } = await myAgent.run("Say hello in one sentence.");

        return { message: output[0].content };
    }
);