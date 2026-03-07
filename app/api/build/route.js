import { Sandbox } from "e2b";
import { NextResponse } from "next/server";
import { getBuild } from "./builds";

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const sandboxId = searchParams.get("sandboxId");

    // ── Poll by eventId (primary mode used by the build page) ──
    if (eventId) {
        const build = getBuild(eventId);
        if (!build) {
            return NextResponse.json({ ready: false, status: "pending" });
        }
        if (build.error) {
            return NextResponse.json({
                ready: false,
                status: "error",
                error: build.error,
            });
        }
        return NextResponse.json({
            ready: true,
            url: build.url,
            sandboxId: build.sandboxId,
        });
    }

    // ── Poll by sandboxId (legacy / direct check) ──
    if (!sandboxId) {
        return NextResponse.json(
            { error: "eventId or sandboxId is required" },
            { status: 400 }
        );
    }

    try {
        const sandbox = await Sandbox.connect(sandboxId, {
            apiKey: process.env.E2B_API_KEY,
        });

        // Check if the dev server is up
        let ready = false;
        try {
            const result = await sandbox.commands.run("nc -z localhost 3000", {
                timeout: 2000,
            });
            ready = result.exitCode === 0;
        } catch {
            ready = false;
        }

        const host = sandbox.getHost(3000);
        const url = `https://${host}`;

        return NextResponse.json({ ready, url, sandboxId });
    } catch (error) {
        return NextResponse.json(
            { ready: false, error: error.message },
            { status: 200 }
        );
    }
}
