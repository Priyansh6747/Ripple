"use server"

import { inngest } from "../../lib/inngest/client"

export const onInvokeAI = async (prompt) => {
    const result = await inngest.send({
        name: "test/hello",
        data: { prompt },
    })
    // result.ids contains the event IDs assigned by Inngest
    return { ids: result.ids }
}

export const onTestGemini = async () => {
    const result = await inngest.send({
        name: "test/gemini",
        data: { prompt: "Say hello in one sentence." },
    })
    return result
}