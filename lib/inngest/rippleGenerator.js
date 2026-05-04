import { inngest } from "./client";
import { createAgent, createNetwork, gemini, createTool } from "@inngest/agent-kit";
import { Sandbox } from "e2b";
import { z } from "zod";
import { setBuild } from "../../app/api/build/builds";
import { SCHEMA_PROMPT } from "../rippleConfigSchema";

// ─── save_config tool ─────────────────────────────────────────────────────────

const saveConfig = createTool({
    name: "save_config",
    description: "Save the complete RIPPLE_CONFIG JSON to network state.",
    parameters: z.object({ config: z.string() }),
    handler: async ({ config }, { network }) => {
        network?.state.kv.set("config", JSON.parse(config));
        return "Config saved.";
    },
});

// ─── Validation ───────────────────────────────────────────────────────────────

function validateAndSanitise(config) {
    const VALID_ICONS = ["Zap","Shield","BarChart3","Layers","Globe","Sparkles","Code","Lock","Users","Rocket","Star","Heart"];
    const FIXED_SPANS = ["col-span-12 md:col-span-4","col-span-12 md:col-span-8","col-span-12 md:col-span-8","col-span-12 md:col-span-4"];

    if (config.features?.items) {
        config.features.items = config.features.items.slice(0, 6)
            .map(f => ({ ...f, icon: VALID_ICONS.includes(f.icon) ? f.icon : "Sparkles" }));
        while (config.features.items.length < 6)
            config.features.items.push({ icon: "Star", title: "Feature", description: "Coming soon." });
    }
    if (config.bouncyCards?.cards) {
        config.bouncyCards.cards = config.bouncyCards.cards.slice(0, 4)
            .map((c, i) => ({ ...c, span: FIXED_SPANS[i], demoTextColor: "text-white" }));
    }
    if (config.pricing?.plans?.length === 3) {
        config.pricing.plans = config.pricing.plans.map((p, i) => ({ ...p, popular: i === 1 }));
    }
    const fixAvatar = arr => arr?.map(r => ({
        ...r,
        img: `https://avatar.vercel.sh/${(r.username || r.name || "user").replace("@","").toLowerCase().split(" ")[0]}`,
    }));
    if (config.testimonials?.reviews) config.testimonials.reviews = fixAvatar(config.testimonials.reviews);
    if (config.marqueeReviews) config.marqueeReviews = fixAvatar(config.marqueeReviews);
    if (config.dashboard?.chartData) {
        config.dashboard.chartData = config.dashboard.chartData.slice(0, 7)
            .map(d => ({ ...d, revenue: Math.max(0, Number(d.revenue) || 0) }));
    }
    return config;
}

// ─── Programmatic file builders (zero LLM) ───────────────────────────────────

/** Replace the `const UI = { ... };` block in a file using brace-matching. */
function replaceUIConst(content, newUI) {
    const marker = "const UI = {";
    const start = content.indexOf(marker);
    if (start === -1) return content;
    let depth = 0, end = -1;
    for (let i = content.indexOf("{", start); i < content.length; i++) {
        if (content[i] === "{") depth++;
        else if (content[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) return content;
    const tail = content[end + 1] === ";" ? end + 2 : end + 1;
    return content.slice(0, start) + `const UI = ${JSON.stringify(newUI, null, 2)};` + content.slice(tail);
}

function buildUITextJs(c) {
    const ui = {
        siteName: c.brand.siteName,
        siteTagline: c.brand.siteTagline,
        nav: c.nav,
        hero: c.hero,
        features: c.features,
        productDemo: c.productDemo,
        testimonials: c.testimonials,
        pricing: { badge: c.pricing.badge, title: c.pricing.title, titleAccent: c.pricing.titleAccent, subtitle: c.pricing.subtitle, plans: c.pricing.plans },
        faq: c.faq,
        cta: c.cta,
        footer: c.footer,
        auth: c.auth,
        dashboard: c.dashboard,
    };
    return `export const UI = ${JSON.stringify(ui, null, 2)};\n`;
}

/** Patch only the brand/accent/button hex values in Color.js, keep everything else. */
function patchColorJs(content, brandColors) {
    const { light, dark } = brandColors;

    // Replace a specific key's hex value within a bounded section of the file.
    function replaceHex(text, fromIdx, toIdx, key, value) {
        const section = text.slice(fromIdx, toIdx);
        const patched = section.replace(
            new RegExp(`(\\b${key}\\s*:\\s*)"#[0-9a-fA-F]{3,8}"`, ""),
            `$1"${value}"`
        );
        return text.slice(0, fromIdx) + patched + text.slice(toIdx);
    }

    // Locate light and dark section boundaries
    const lightStart = content.indexOf("light:");
    const darkStart  = content.indexOf("dark:");
    if (lightStart === -1 || darkStart === -1) return content;

    // Patch light section
    const lightPairs = [
        ["primary", light.primary], ["hover", light.hover], ["active", light.active],
        ["soft", light.soft], ["subtle", light.subtle], ["accent", light.accent],
    ];
    let out = content;
    for (const [key, val] of lightPairs) {
        out = replaceHex(out, lightStart, darkStart, key, val);
    }

    // Recalculate darkStart after light patches (lengths may change)
    const ds = out.indexOf("dark:");
    const darkPairs = [
        ["primary", dark.primary], ["hover", dark.hover], ["active", dark.active],
        ["soft", dark.soft], ["subtle", dark.subtle], ["accent", dark.accent],
    ];
    for (const [key, val] of darkPairs) {
        out = replaceHex(out, ds, out.length, key, val);
    }
    return out;
}

function buildAllFileContents(config, currentFiles) {
    const c = config;
    return {
        "Constants/UIText.js": buildUITextJs(c),
        "Constants/Color.js": patchColorJs(currentFiles["Constants/Color.js"], c.brandColors),
        "app/page.js": replaceUIConst(currentFiles["app/page.js"], {
            socialProofTitle: c.homePage.socialProofTitle,
            socialProofSubtitle: c.homePage.socialProofSubtitle,
            ctaTitle: c.homePage.ctaTitle,
            ctaSubtitle: c.homePage.ctaSubtitle,
            ctaPrimary: c.homePage.ctaPrimary,
            ctaPrimaryHref: c.homePage.ctaPrimaryHref,
            ctaSecondary: c.homePage.ctaSecondary,
            ctaSecondaryHref: c.homePage.ctaSecondaryHref,
        }),
        "app/pricing/page.js": replaceUIConst(currentFiles["app/pricing/page.js"], {
            launchHeader: c.pricing.launchHeader,
            launchSub: c.pricing.launchSub,
            pricingTitle: c.pricing.pricingTitle,
            pricingSubtitle: c.pricing.pricingSubtitle,
            plans: c.pricing.plans,
        }),
        "app/features/page.js": replaceUIConst(currentFiles["app/features/page.js"], {
            headerTitle: c.featuresPage.headerTitle,
            headerSubtitle: c.featuresPage.headerSubtitle,
            developerTitle: c.featuresPage.developerTitle,
            developerDesc: c.featuresPage.developerDesc,
            integrationTitle: c.featuresPage.integrationTitle,
            integrationDesc: c.featuresPage.integrationDesc,
        }),
        "app/product/page.js": replaceUIConst(currentFiles["app/product/page.js"], {
            launchHeader: c.productPage.launchHeader,
            launchSub: c.productPage.launchSub,
        }),
        "components/Custom/Hero/AuroraHero.jsx": replaceUIConst(currentFiles["components/Custom/Hero/AuroraHero.jsx"], {
            badge: c.auroraHero.badge,
            headline: c.auroraHero.headline,
            subheadline: c.auroraHero.subheadline,
            ctaText: c.auroraHero.ctaText,
            ctaHref: c.auroraHero.ctaHref,
        }),
        "components/Custom/Features/BouncyCard.jsx": replaceUIConst(currentFiles["components/Custom/Features/BouncyCard.jsx"], {
            title: c.bouncyCards.title,
            titleAccent: c.bouncyCards.titleAccent,
            cta: c.bouncyCards.cta,
            ctaHref: c.bouncyCards.ctaHref,
            cards: c.bouncyCards.cards,
        }),
        "components/Custom/MarqueeDemo.jsx": replaceUIConst(currentFiles["components/Custom/MarqueeDemo.jsx"], {
            reviews: c.marqueeReviews,
        }),
    };
}

// ─── Template file paths ──────────────────────────────────────────────────────

const TEMPLATE_FILES = [
    "Constants/UIText.js", "Constants/Color.js",
    "app/page.js", "app/pricing/page.js", "app/features/page.js", "app/product/page.js",
    "components/Custom/Hero/AuroraHero.jsx",
    "components/Custom/Features/BouncyCard.jsx",
    "components/Custom/MarqueeDemo.jsx",
];

// ─── Inngest Function ─────────────────────────────────────────────────────────

export const rippleGenerator = inngest.createFunction(
    { id: "ripple-generator", retries: 0 },
    { event: "ripple/generate" },

    async ({ event, step }) => {
        const prompt = event.data?.prompt || "Build a modern SaaS landing page";
        const eventId = event.id;

        try {
            // Step 1: Spin up E2B sandbox
            const sandboxId = await step.run("create-sandbox", async () => {
                const sb = await Sandbox.create("qps2bs9i1k2hs7r27g7v", {
                    apiKey: process.env.E2B_API_KEY,
                    timeout: 300_000,
                });
                return sb.sandboxId;
            });

            // Step 2: LLM generates + validates config (self-contained)
            const validatedConfig = await step.run("generate-config", async () => {
                const agent = createAgent({
                    name: "config_generator",
                    system: `You are a SaaS copywriter for RippleTemplates. Given a product description, produce a complete RIPPLE_CONFIG matching this schema EXACTLY:\n\n${SCHEMA_PROMPT}\n\nRULES:\n- hero.title ≤5 words, no period; titleAccent 2-3 words that complete it\n- features.items: exactly 6; icons only: Zap Shield BarChart3 Layers Globe Sparkles Code Lock Users Rocket Star Heart\n- bouncyCards.cards: exactly 4 with FIXED spans: [col-span-12 md:col-span-4, col-span-12 md:col-span-8, col-span-12 md:col-span-8, col-span-12 md:col-span-4]\n- Use 4 different gradient pairs from: from-blue-500/to-cyan-400, from-purple-500/to-pink-500, from-emerald-400/to-teal-500, from-orange-400/to-red-500, from-indigo-500/to-violet-500\n- testimonials.reviews: 8; marqueeReviews: 6 different people\n- pricing.plans: 3 (popular false/true/false)\n- faq.items:5 dashboard.stats:4 dashboard.chartData:7 dashboard.recentItems:5 nav.links:3 footer.groups:3x3 productDemo.tabs:3 dashboard.sidebarNav:5\n- avatars: https://avatar.vercel.sh/<firstname>\n- Colors: dev=#5B4DFF, finance=#2563EB, health=#059669, creative=#D946EF, data=#4F46E5, security=#1D4ED8\n\nCall save_config with the complete JSON. No preamble.`,
                    tools: [saveConfig],
                });
                const network = createNetwork({
                    name: "config-net",
                    agents: [agent],
                    defaultModel: gemini({ model: "gemini-2.5-flash" }),
                    maxIter: 3,
                    router: ({ network: n }) => n?.state.kv.has("config") ? undefined : agent,
                });
                await network.run(prompt);
                const raw = network.state.kv.get("config");
                if (!raw) throw new Error("Config agent produced no output");
                return validateAndSanitise(raw);
            });

            // Step 3: Read all 9 template files from sandbox (no LLM)
            const fileContents = await step.run("read-template-files", async () => {
                const sb = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });
                const out = {};
                for (const path of TEMPLATE_FILES) {
                    out[path] = await sb.files.read(`/home/user/app/${path}`);
                }
                return out;
            });

            // Step 4: Build all 9 file contents programmatically (zero LLM)
            const newFileContents = await step.run("build-file-contents", async () => {
                return buildAllFileContents(validatedConfig, fileContents);
            });

            // Step 5: Write all 9 files directly to sandbox (zero LLM)
            await step.run("write-files", async () => {
                const sb = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });
                for (const [path, content] of Object.entries(newFileContents)) {
                    await sb.files.write(`/home/user/app/${path}`, content);
                }
                return "All 9 files written.";
            });

            // Step 6: Wait for Next.js dev server
            const sandboxURL = await step.run("get-sandbox-url", async () => {
                const sb = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });
                
                await sb.commands.run("npm run dev", { background: true, cwd: "/home/user/app" });

                for (let i = 0; i < 60; i++) {
                    try {
                        const r = await sb.commands.run("nc -z localhost 3000", { timeout: 2000 });
                        if (r.exitCode === 0) break;
                    } catch { /* not ready */ }
                    await new Promise(r => setTimeout(r, 2000));
                }
                return `https://${sb.getHost(3000)}`;
            });

            setBuild(eventId, { sandboxId, url: sandboxURL, status: "ready" });
            return { sandboxId, url: sandboxURL };

        } catch (err) {
            setBuild(eventId, { status: "error", error: err.message || "Build failed" });
            throw err;
        }
    }
);
