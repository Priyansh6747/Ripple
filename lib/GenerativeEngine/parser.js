import fs from "fs/promises";
import path from "path";

// ──────────────────────────────────────────────────────────────────────────────
// Utility: strip markdown code fences from LLM responses
// ──────────────────────────────────────────────────────────────────────────────

function stripFences(raw) {
    return raw
        .trim()
        .replace(/^```(?:json|jsx|js|html)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
}

// ──────────────────────────────────────────────────────────────────────────────
// Fetch Wrappers for Groq and Gemini
// ──────────────────────────────────────────────────────────────────────────────

async function callGroq(messages, temperature, max_tokens) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY not set");

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages,
            temperature,
            max_tokens,
            response_format: { type: "json_object" }
        })
    });

    if (!res.ok) throw new Error(`Groq API error: ${await res.text()}`);
    const data = await res.json();
    return stripFences(data.choices[0].message.content);
}

async function callGemini(prompt, expectJson = true) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY not set");

    const model = "gemini-3.1-flash-lite-preview";
    const body = {
        contents: [{ parts: [{ text: prompt }] }],
    };
    if (expectJson) {
        body.generationConfig = { responseMimeType: "application/json" };
    }

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        }
    );

    if (!res.ok) throw new Error(`Gemini API error: ${await res.text()}`);
    const data = await res.json();
    return stripFences(data.candidates[0].content.parts[0].text);
}

// ──────────────────────────────────────────────────────────────────────────────
// Tree helpers (used by the customise.json flow)
// ──────────────────────────────────────────────────────────────────────────────

function _isStructuralKey(key) {
    const structuralPrefixes = [
        "href", "icon", "img", "src",
        "targetDate", "language", "containerSize", "unit",
        "price", "period", "change", "trend", "revenue", "month",
        "popular", "id"
    ];
    return structuralPrefixes.some(p => key === p || key.startsWith(p));
}

function _isColorKey(key) {
    const colorKeywords = [
        "color", "Color", "gradient", "bg", "Bg", "fill", "stroke",
        "background", "Background", "border", "Border", "shadow",
        "palette", "theme", "tint", "accent"
    ];
    return colorKeywords.some(kw => key.includes(kw));
}

function buildSectionSummary(node, maxChars = 600) {
    const leaves = [];

    function _walk(obj, depth = 0) {
        if (depth > 4) return;
        if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
            for (const [k, v] of Object.entries(obj)) {
                if (_isStructuralKey(k)) continue;
                if (typeof v === 'string') {
                    leaves.push(`${k}: ${v.slice(0, 80)}`);
                } else {
                    _walk(v, depth + 1);
                }
            }
        } else if (Array.isArray(obj)) {
            for (const item of obj.slice(0, 3)) {
                _walk(item, depth + 1);
            }
        }
    }

    _walk(node);
    return leaves.join(" | ").slice(0, maxChars);
}

function extractColorKeys(node, path = "") {
    const results = {};

    function _walk(obj, p) {
        if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
            for (const [k, v] of Object.entries(obj)) {
                const full = p ? `${p}.${k}` : k;
                if (typeof v === 'string' && _isColorKey(k)) {
                    results[full] = v;
                } else if (typeof v === 'object' && v !== null) {
                    _walk(v, full);
                }
            }
        } else if (Array.isArray(obj)) {
            obj.forEach((item, i) => {
                _walk(item, `${p}[${i}]`);
            });
        }
    }

    _walk(node, path);
    return results;
}

function applyColorPatch(node, patch) {
    const result = JSON.parse(JSON.stringify(node));

    function _set(obj, parts, value) {
        if (!parts || parts.length === 0) return;
        const key = parts[0];

        if (key.includes('[')) {
            const [k, rest] = key.split('[');
            const idx = parseInt(rest.replace(']', ''), 10);
            const target = k ? obj[k][idx] : obj[idx];

            if (parts.length === 1) {
                if (k) {
                    obj[k][idx] = value;
                } else {
                    obj[idx] = value;
                }
            } else {
                _set(target, parts.slice(1), value);
            }
        } else {
            if (parts.length === 1) {
                if (key in obj) {
                    obj[key] = value;
                }
            } else {
                if (key in obj) {
                    _set(obj[key], parts.slice(1), value);
                }
            }
        }
    }

    for (const [dottedPath, newVal] of Object.entries(patch)) {
        let parts = dottedPath.replace(/\[/g, '.[').split('.');
        parts = parts.filter(p => p);
        _set(result, parts, newVal);
    }

    return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// Step 0 · Groq: expand high-level idea → rewrite prompt + colour palette
// ──────────────────────────────────────────────────────────────────────────────

const IDEA_EXPANSION_SYSTEM = `You are a brand strategist and UI designer.
The user gives you a short product idea. Your job is to output a JSON object with exactly two keys:

{
  "rewrite_prompt": "<detailed content rewrite instructions>",
  "color_palette": {
    "primary": "<hex>", "secondary": "<hex>", "accent": "<hex>", "background": "<hex>",
    "surface": "<hex>", "text": "<hex>", "textMuted": "<hex>", "border": "<hex>",
    "gradient": "<CSS linear-gradient(…)>", "gradientFrom": "<hex>", "gradientTo": "<hex>"
  }
}

The rewrite_prompt MUST be very specific and include ALL of the following:
1. Brand name (invent one that fits the product)
2. Tagline / one-liner
3. The product's domain vocabulary — e.g. for a coffee shop: espresso, latte, pour-over, beans, roast, barista, menu, cosy, etc. These exact words must appear in the content.
4. Explicit instruction: "Replace ALL tech/SaaS jargon (deploys, builds, CI/CD, middleware, edge network, etc.) with words from this product's domain. Do NOT keep any language from the original template."
5. Tone (e.g. warm and artisan, playful, corporate, luxurious)
6. Concrete examples of what old content should become, e.g.:
   - "Instant Deploys" → "Fresh Daily Roasts"
   - "100 Builds/month" → "Unlimited Coffee Orders"
   - "Global Edge Network" → "City-Wide Delivery"
   - hero subtitle → a 1-sentence pitch for this specific business
7. What the pricing plans should represent for this business.

- color_palette must suit the product's aesthetic perfectly.
- Output ONLY valid JSON.`;

async function expandIdeaWithGroq(idea) {
    const messages = [
        { role: "system", content: IDEA_EXPANSION_SYSTEM },
        { role: "user", content: `Product idea: ${idea}` }
    ];
    console.log("⟳ Groq: expanding product idea into rewrite prompt + colour palette …");
    const raw = await callGroq(messages, 0.4, 1200);
    const data = JSON.parse(raw);
    return { prompt: data.rewrite_prompt, palette: data.color_palette };
}

// ──────────────────────────────────────────────────────────────────────────────
// Template registry
// ──────────────────────────────────────────────────────────────────────────────

export const TEMPLATES = [
    {
        id: "ripple",
        url: "https://github.com/Priyansh6747/RippleTemplates.git",
        description: "Dark themed, technical, or modern sleek SaaS applications with rich component libraries"
    },
    {
        id: "nexus",
        url: "https://github.com/Monkey-hmm/Nexus.git",
        description: "White, light, clean, or warm themed applications with a polished minimal look"
    },
    {
        id: "basicnext",
        url: "https://github.com/Monkey-hmm/BasicNext.git",
        description: "Simple, portfolio, personal, informational, or brochure-style sites that do not need heavy UI libraries"
    }
];

const TEMPLATE_SELECTION_SYSTEM = `You are a template selection assistant.
Based on the visual theme and complexity implied by the user's product idea, select the best template by returning its index.

Templates:
${TEMPLATES.map((t, i) => `${i} (${t.id}): ${t.description}`).join("\n")}

IMPORTANT: Choose BasicNext (index 2) for simple, small, personal, portfolio, or purely informational sites.
Choose Ripple or Nexus only for feature-rich SaaS products with pricing, dashboards, and complex sections.

Output ONLY a JSON object: { "templateIndex": <number> }`;

export async function selectTemplate(idea) {
    const messages = [
        { role: "system", content: TEMPLATE_SELECTION_SYSTEM },
        { role: "user", content: `Product idea: ${idea}` }
    ];
    console.log("⟳ Groq: selecting template based on idea …");
    try {
        const raw = await callGroq(messages, 0.1, 200);
        const data = JSON.parse(raw);
        const index = data.templateIndex;
        if (typeof index === 'number' && index >= 0 && index < TEMPLATES.length) {
            console.log(`✅ Selected template [${index}]: ${TEMPLATES[index].id} — ${TEMPLATES[index].url}`);
            return TEMPLATES[index];
        }
        console.warn("⚠️ Invalid index from LLM, defaulting to index 0 (ripple).");
        return TEMPLATES[0];
    } catch (err) {
        console.error("⚠️ Template selection failed, defaulting to ripple:", err);
        return TEMPLATES[0];
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Step 0b · Groq: map palette onto existing colour keys
// ──────────────────────────────────────────────────────────────────────────────

const COLOR_MAPPING_SYSTEM = `You are a JSON colour-remapping assistant.
You will receive:
  1. A brand colour palette.
  2. A flat list of existing colour keys from a JSON config, each with its current value.

Your task: produce a JSON object mapping each existing colour key to its new value drawn from the palette.
Use your best judgement to match semantic intent.

Rules:
- Output ONLY valid JSON – no markdown, no prose.
- Every key from the input list must appear in your output.`;

async function mapPaletteToKeys(existingColorKeys, palette) {
    if (Object.keys(existingColorKeys).length === 0) return {};

    const message = `Brand palette:\n${JSON.stringify(palette, null, 2)}\n\n` +
        `Existing colour keys:\n${JSON.stringify(existingColorKeys, null, 2)}\n\n` +
        `Map each key to its new colour from the palette. Output JSON only.`;

    const messages = [
        { role: "system", content: COLOR_MAPPING_SYSTEM },
        { role: "user", content: message }
    ];

    console.log(`⟳ Groq: mapping palette onto ${Object.keys(existingColorKeys).length} colour key(s) …`);
    const raw = await callGroq(messages, 0.1, 1024);
    return JSON.parse(raw);
}

// ──────────────────────────────────────────────────────────────────────────────
// Step 1 · Groq: decide which sections to rewrite
// ──────────────────────────────────────────────────────────────────────────────

const SECTION_SELECTION_SYSTEM = `You are a routing assistant for a JSON customisation file.
Given a user rewrite prompt and a brief summary of each section, output a JSON array of section keys that need to be updated.

Rules:
- Output ONLY valid JSON — a plain array of strings.
- Include a section if any of its text content should change.
- Exclude structural sections: brandColors, iconCloud, countdown, codeDemo, tooltip, checkbox.
- For a full rebrand, include the major text sections.
Output format: { "sections": ["section1", "section2"] }`;

async function selectSectionsWithGroq(sectionSummaries, userPrompt) {
    const summariesText = Object.entries(sectionSummaries)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join("\n");

    const message = `User rewrite prompt:\n${userPrompt}\n\n` +
        `Section summaries:\n${summariesText}\n\n` +
        `Which section keys should be rewritten? Output a JSON object with a "sections" array.`;

    const messages = [
        { role: "system", content: SECTION_SELECTION_SYSTEM },
        { role: "user", content: message }
    ];

    console.log("⟳ Groq: selecting sections to rewrite …");
    const raw = await callGroq(messages, 0.1, 512);
    const data = JSON.parse(raw);
    return data.sections || [];
}

// ──────────────────────────────────────────────────────────────────────────────
// Step 2 · Gemini: rewrite a single section
// ──────────────────────────────────────────────────────────────────────────────

async function rewriteSectionWithGemini(sectionKey, sectionData, userPrompt, retry = 3) {
    const sectionJson = JSON.stringify(sectionData, null, 2);

    const prompt = `You are a JSON content editor performing a full domain rebrand.

RULES (strictly follow every one):
- Output ONLY valid JSON — no markdown, no explanation, no code fences.
- Preserve ALL keys exactly as-is.
- Preserve ALL non-text values: hrefs, icon names, image URLs, hex colors, booleans, numbers used as IDs.
- Do NOT add or remove keys. Do NOT change array lengths.
- AGGRESSIVELY replace every human-readable text string so it fits the new brand.
  - There must be ZERO leftover words from the original SaaS/tech template (no "deploys", "builds", "CI/CD", "middleware", "edge", "pipelines", "DevOps", etc.) unless the new brand is itself a tech product.
  - Every title, subtitle, badge, label, description, button, review, testimonial, and stat label must make sense for the new product.
  - Stat demo labels (e.g. "12ms", "100% Coverage") should become domain-appropriate figures (e.g. "4.9★", "200+ Blends").
  - Pricing feature lists must describe the new product's actual tiers, not software features.
  - Testimonial/review quotes must sound like real customers of the new product.

REWRITE PROMPT (follow this precisely):
${userPrompt}

Section key: ${sectionKey}
Current JSON (rebrand every text string inside it):
${sectionJson}

Return only the fully rebranded JSON object.`;

    for (let attempt = 1; attempt <= retry; attempt++) {
        try {
            console.log(`⟳ Gemini: rewriting [${sectionKey}] (attempt ${attempt}) …`);
            const raw = await callGemini(prompt, true);
            return JSON.parse(stripFences(raw));
        } catch (exc) {
            console.error(`⚠️ [${sectionKey}] Gemini/Parse error on attempt ${attempt}:`, exc);
            if (attempt === retry) return sectionData;
            await new Promise(r => setTimeout(r, 1500));
        }
    }
    return sectionData;
}

// ──────────────────────────────────────────────────────────────────────────────
// Deep merge
// ──────────────────────────────────────────────────────────────────────────────

function deepMerge(original, patch) {
    if (typeof original === 'object' && original !== null && typeof patch === 'object' && patch !== null) {
        if (Array.isArray(original) || Array.isArray(patch)) {
            return JSON.parse(JSON.stringify(patch));
        }
        const merged = JSON.parse(JSON.stringify(original));
        for (const [k, v] of Object.entries(patch)) {
            if (k in merged) {
                merged[k] = deepMerge(merged[k], v);
            } else {
                merged[k] = JSON.parse(JSON.stringify(v));
            }
        }
        return merged;
    }
    return JSON.parse(JSON.stringify(patch));
}

// ──────────────────────────────────────────────────────────────────────────────
// Main generation flow (customise.json templates: ripple / nexus)
// ──────────────────────────────────────────────────────────────────────────────

export async function generateCustomiseJson(originalJson, idea) {
    const SKIP_ALWAYS = new Set(["_instructions", "brandColors", "iconCloud", "countdown", "codeDemo", "tooltip", "checkbox"]);

    const allSections = {};
    for (const [k, v] of Object.entries(originalJson)) {
        if (!SKIP_ALWAYS.has(k)) {
            allSections[k] = v;
        }
    }

    const { prompt: rewritePrompt, palette } = await expandIdeaWithGroq(idea);
    console.log("✓ Rewrite prompt generated:", rewritePrompt);
    console.log("✓ Colour palette:", palette);

    const existingColors = extractColorKeys(originalJson);
    const colorPatch = await mapPaletteToKeys(existingColors, palette);
    console.log(`✓ Colour mapping complete (${Object.keys(colorPatch).length} key(s) updated)`);

    const sectionSummaries = {};
    for (const [k, v] of Object.entries(allSections)) {
        sectionSummaries[k] = buildSectionSummary(v);
    }

    let selected = await selectSectionsWithGroq(sectionSummaries, rewritePrompt);
    selected = selected.filter(s => s in allSections);
    console.log(`✓ Groq selected ${selected.length} section(s) to rewrite:`, selected);

    const rewrittenSections = {};
    for (const sectionKey of selected) {
        rewrittenSections[sectionKey] = await rewriteSectionWithGemini(
            sectionKey,
            originalJson[sectionKey],
            rewritePrompt
        );
    }

    let outputData = JSON.parse(JSON.stringify(originalJson));

    for (const [k, v] of Object.entries(rewrittenSections)) {
        outputData[k] = deepMerge(outputData[k], v);
    }

    if (Object.keys(colorPatch).length > 0) {
        outputData = applyColorPatch(outputData, colorPatch);
    }

    return outputData;
}

// ──────────────────────────────────────────────────────────────────────────────
// BasicNext generation flow
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The 4 files BasicNext exposes for AI generation.
 * Paths are relative to the repo root (i.e. /home/user/app/<path>).
 */
export const BASIC_NEXT_FILES = [
    "app/page.js",
    "app/about/page.js",
    "app/pricing/page.js",
    "app/layout.js",
];

const BASIC_NEXT_FILE_PROMPTS = {
    "app/page.js": `You are writing the Home page (app/page.js) for a Next.js 14 App Router project.
This is a React Server Component — no "use client" directive, no useState/useEffect.
Output ONLY the complete file content — raw JSX/JS, no markdown fences, no explanation.

Rules:
- Keep all existing import paths exactly as they are in the original file.
- You MAY replace text content, className values, and inline styles freely.
- Do NOT add new imports or remove existing ones.
- Do NOT create new components — reuse what the original imports.
- The page must be visually appealing, on-brand, and complete.`,

    "app/about/page.js": `You are writing the About page (app/about/page.js) for a Next.js 14 App Router project.
This is a React Server Component — no "use client" directive, no useState/useEffect.
Output ONLY the complete file content — raw JSX/JS, no markdown fences, no explanation.

Rules:
- Keep all existing import paths exactly as they are in the original file.
- You MAY replace text content, className values, and inline styles freely.
- Do NOT add new imports or remove existing ones.
- Do NOT create new components — reuse what the original imports.
- The page must tell a compelling brand story for this product.`,

    "app/pricing/page.js": `You are writing the Pricing page (app/pricing/page.js) for a Next.js 14 App Router project.
This is a React Server Component — no "use client" directive, no useState/useEffect.
Output ONLY the complete file content — raw JSX/JS, no markdown fences, no explanation.

Rules:
- Keep all existing import paths exactly as they are in the original file.
- You MAY replace text content, className values, and inline styles freely.
- Do NOT add new imports or remove existing ones.
- Do NOT create new components — reuse what the original imports.
- Show 3 pricing tiers appropriate for this product. Make the middle plan visually highlighted.`,

    "app/layout.js": `You are updating the root layout (app/layout.js) for a Next.js 14 App Router project.
Output ONLY the complete file content — raw JSX/JS, no markdown fences, no explanation.

Rules:
- Keep all existing import paths exactly as they are in the original file.
- Update metadata (title, description) to match the new brand.
- You MAY update nav links, footer text, brand name, and colour class names.
- Do NOT add new imports or remove existing ones unless removing an unused font import.
- Preserve the <html>, <body>, {children} structure exactly.`,
};

/**
 * Generate a single BasicNext file using Gemini.
 * @param {string} filePath   - relative path e.g. "app/page.js"
 * @param {string} original   - current file content read from sandbox
 * @param {string} idea       - the user's product idea
 * @param {string} brandContext - shared brand context string (name, palette, tone)
 * @returns {Promise<string>} - new file content
 */
async function generateBasicNextFile(filePath, original, idea, brandContext, retry = 3) {
    const systemPrompt = BASIC_NEXT_FILE_PROMPTS[filePath] || BASIC_NEXT_FILE_PROMPTS["app/page.js"];

    const prompt = `${systemPrompt}

BRAND CONTEXT (apply to every visible string):
${brandContext}

ORIGINAL FILE (${filePath}):
\`\`\`
${original}
\`\`\`

Now output the complete rewritten file for the brand above. Raw code only — no markdown, no fences.`;

    for (let attempt = 1; attempt <= retry; attempt++) {
        try {
            console.log(`⟳ Gemini: generating BasicNext [${filePath}] (attempt ${attempt}) …`);
            // expectJson = false — we want raw JSX/JS, not JSON
            const raw = await callGemini(prompt, false);
            const content = stripFences(raw);
            if (content.length < 50) throw new Error("Response too short, likely empty");
            return content;
        } catch (err) {
            console.error(`⚠️ [${filePath}] Generation error on attempt ${attempt}:`, err.message);
            if (attempt === retry) {
                console.warn(`⚠️ [${filePath}] All attempts failed, returning original.`);
                return original;
            }
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    return original;
}

/**
 * Expand the user's idea into a rich brand context string (used by all 4 file generators).
 * Returns a plain-text brand brief — NOT JSON — so it's easy to inject into code prompts.
 */
async function buildBrandContext(idea) {
    const messages = [
        {
            role: "system",
            content: `You are a brand strategist. Given a product idea, produce a concise brand brief as a JSON object with these keys:
{
  "brandName": "...",
  "tagline": "...",
  "tone": "...",
  "primaryColor": "<hex>",
  "accentColor": "<hex>",
  "domainVocabulary": ["word1", "word2", ...],
  "navLinks": [{"label":"...", "href":"..."}],
  "pricingTiers": [{"name":"...", "price":"...", "description":"..."}]
}
Output ONLY valid JSON.`
        },
        { role: "user", content: `Product idea: ${idea}` }
    ];

    console.log("⟳ Groq: building brand context for BasicNext …");
    const raw = await callGroq(messages, 0.4, 800);
    const brand = JSON.parse(raw);

    // Serialise into a human-readable context block for injection into code prompts
    return `Brand name: ${brand.brandName}
Tagline: ${brand.tagline}
Tone: ${brand.tone}
Primary colour: ${brand.primaryColor}
Accent colour: ${brand.accentColor}
Domain vocabulary (use these words throughout): ${brand.domainVocabulary.join(", ")}
Nav links: ${JSON.stringify(brand.navLinks)}
Pricing tiers: ${JSON.stringify(brand.pricingTiers)}`;
}

/**
 * Main entry point for BasicNext generation.
 * Takes the 4 original file contents and the user idea,
 * generates all 4 files in parallel, returns a map of path → new content.
 *
 * @param {Record<string, string>} originalFiles - { "app/page.js": "...", ... }
 * @param {string} idea
 * @returns {Promise<Record<string, string>>}
 */
export async function generateBasicNextFiles(originalFiles, idea) {
    // Step 1: build shared brand context once (cheap Groq call)
    const brandContext = await buildBrandContext(idea);
    console.log("✓ Brand context built:\n", brandContext);

    // Step 2: generate all 4 files in parallel
    const entries = Object.entries(originalFiles);
    const results = await Promise.all(
        entries.map(([filePath, original]) =>
            generateBasicNextFile(filePath, original, idea, brandContext)
        )
    );

    const output = {};
    entries.forEach(([filePath], i) => {
        output[filePath] = results[i];
    });

    console.log(`✓ BasicNext generation complete — ${Object.keys(output).length} files produced`);
    return output;
}