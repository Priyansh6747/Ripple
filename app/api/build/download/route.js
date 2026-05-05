import { Sandbox } from "e2b";
import { NextResponse } from "next/server";

const ZIP_PATH = "/tmp/ripple-project.zip";

export async function POST(request) {
    try {
        const { sandboxId } = await request.json();
        if (!sandboxId) {
            return NextResponse.json(
                { error: "sandboxId is required" },
                { status: 400 }
            );
        }

        const sandbox = await Sandbox.connect(sandboxId, {
            apiKey: process.env.E2B_API_KEY,
        });

        const zipCmd = [
            "rm -f /tmp/ripple-project.zip",
            "cd /home/user",
            "zip -r -q /tmp/ripple-project.zip app",
        ].join(" && ");

        const zipResult = await sandbox.commands.run(zipCmd, { timeout: 120_000 });
        if (zipResult.exitCode !== 0) {
            return NextResponse.json(
                { error: "Failed to create project zip in sandbox." },
                { status: 500 }
            );
        }

        // Important: force binary read to avoid UTF-8 corruption of zip bytes.
        const bytes = await sandbox.files.read(ZIP_PATH, { format: "bytes" });
        const filename = `ripple-project-${sandboxId}.zip`;

        return new NextResponse(bytes, {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: error.message || "Failed to download project." },
            { status: 500 }
        );
    }
}
