"use server"

import {inngest} from "lib/inngest/client"

const onInvokeAI = async ()=>{
    await inngest.send({
        name: "test/hello"
    })
}