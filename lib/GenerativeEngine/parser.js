import fs from "fs/promises";
import path from "path";

// ──────────────────────────────────────────────────────────────────────────────
// Utility: strip markdown code fences from LLM responses
// ──────────────────────────────────────────────────────────────────────────────

function stripFences(raw) {
    // Remove ```json ... ``` or ``` ... ``` wrappers that models sometimes emit
    // even when told not to.
    return raw
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
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
    // Groq with response_format json_object is reliable, but strip fences defensively
    return stripFences(data.choices[0].message.content);
}

async function callGemini(prompt) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY not set");

    const model = "gemini-3-flash-preview";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        })
    });

    if (!res.ok) throw new Error(`Gemini API error: ${await res.text()}`);
    const data = await res.json();
    // Gemini sometimes wraps output in ```json fences despite responseMimeType — strip them.
    return stripFences(data.candidates[0].content.parts[0].text);
}

// ──────────────────────────────────────────────────────────────────────────────
// Tree helpers
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
// Step 0a · Groq: Template Selection
// ──────────────────────────────────────────────────────────────────────────────

const TEMPLATES = [
    {
        url: "https://github.com/Priyansh6747/RippleTemplates.git",
        description: "Dark themed, technical, or modern sleek applications"
    },
    {
        url: "https://github.com/Monkey-hmm/Nexus.git",
        description: "White, light, clean, or warm themed applications"
    }
];

const TEMPLATE_SELECTION_SYSTEM = `You are a template selection assistant.
Based on the visual theme implied by the user's product idea, select the best template by returning its index from the list below:
${TEMPLATES.map((t, i) => `${i}: ${t.description}`).join("\n")}

Output ONLY a JSON object with a single key "templateIndex" (integer):
{ "templateIndex": <number> }`;

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
            console.log(`✅ Selected template [${index}]: ${TEMPLATES[index].url}`);
            return TEMPLATES[index].url;
        }
        console.warn("⚠️ Invalid index from LLM, defaulting to index 0.");
        console.log(`✅ Selected template [0]: ${TEMPLATES[0].url}`);
        return TEMPLATES[0].url;
    } catch (err) {
        console.error("⚠️ Template selection failed, defaulting to dark template:", err);
        console.log(`✅ Selected template [0]: ${TEMPLATES[0].url}`);
        return TEMPLATES[0].url;
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
            const raw = await callGemini(prompt);
            // ✅ FIX: strip fences before parsing — Gemini sometimes ignores
            // responseMimeType and wraps output in ```json ... ``` blocks.
            return JSON.parse(stripFences(raw));
        } catch (exc) {
            console.error(`⚠️ [${sectionKey}] Gemini/Parse error on attempt ${attempt}:`, exc);
            if (attempt === retry) return sectionData; // Fallback to original
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
            return JSON.parse(JSON.stringify(patch)); // Arrays are completely replaced
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
// Main generation flow
// ──────────────────────────────────────────────────────────────────────────────

export async function generateCustomiseJson(originalJson, idea) {
    const SKIP_ALWAYS = new Set(["_instructions", "brandColors", "iconCloud", "countdown", "codeDemo", "tooltip", "checkbox"]);

    const allSections = {};
    for (const [k, v] of Object.entries(originalJson)) {
        if (!SKIP_ALWAYS.has(k)) {
            allSections[k] = v;
        }
    }

    // Step 0: Idea expansion
    const { prompt: rewritePrompt, palette } = await expandIdeaWithGroq(idea);
    console.log("✓ Rewrite prompt generated:", rewritePrompt);
    console.log("✓ Colour palette:", palette);

    // Step 0b: Colour mapping
    const existingColors = extractColorKeys(originalJson);
    const colorPatch = await mapPaletteToKeys(existingColors, palette);
    console.log(`✓ Colour mapping complete (${Object.keys(colorPatch).length} key(s) updated)`);

    // Step 1: Section selection
    const sectionSummaries = {};
    for (const [k, v] of Object.entries(allSections)) {
        sectionSummaries[k] = buildSectionSummary(v);
    }

    let selected = await selectSectionsWithGroq(sectionSummaries, rewritePrompt);
    selected = selected.filter(s => s in allSections);
    console.log(`✓ Groq selected ${selected.length} section(s) to rewrite:`, selected);

    // Step 2: Rewrite sections
    const rewrittenSections = {};
    for (const sectionKey of selected) {
        rewrittenSections[sectionKey] = await rewriteSectionWithGemini(
            sectionKey,
            originalJson[sectionKey],
            rewritePrompt
        );
    }

    // Step 3: Merge everything
    let outputData = JSON.parse(JSON.stringify(originalJson));

    for (const [k, v] of Object.entries(rewrittenSections)) {
        outputData[k] = deepMerge(outputData[k], v);
    }

    if (Object.keys(colorPatch).length > 0) {
        outputData = applyColorPatch(outputData, colorPatch);
    }

    return outputData;
}