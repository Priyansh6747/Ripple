"use server"

import { inngest } from "../../lib/inngest/client"

export const onInvokeAI = async (prompt) => {
    const result = await inngest.send({
        name: "test/hello",
        data: { prompt },
    })
    return result
}

export const onTestGemini = async () => {
    const result = await inngest.send({
        name: "test/gemini",
        data: { prompt: "Say hello in one sentence." },
    })
    return result
}