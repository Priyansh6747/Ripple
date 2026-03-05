"use server"

import { inngest } from "../../lib/inngest/client"

export const onInvokeAI = async () => {
    await inngest.send({
        name: "test/hello"
    })
}