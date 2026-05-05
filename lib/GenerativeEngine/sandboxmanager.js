import { Sandbox } from "e2b";

/**
 * Downloads a file from the E2B sandbox.
 */
export async function downloadFileFromSandbox(sandbox, remotePath, maxRetries = 3) {
    let lastErr;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const content = await sandbox.files.read(remotePath);
            if (typeof content === 'string') {
                return content;
            } else if (content instanceof Uint8Array || Buffer.isBuffer(content)) {
                return new TextDecoder().decode(content);
            }
            return String(content);
        } catch (err) {
            console.error(`[E2B] Failed to read ${remotePath} (attempt ${i + 1}):`, err.message || err);
            lastErr = err;
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    throw lastErr;
}

/**
 * Uploads (or overwrites) a file in the E2B sandbox.
 */
export async function uploadFileToSandbox(sandbox, remotePath, fileContent, maxRetries = 3) {
    let lastErr;
    for (let i = 0; i < maxRetries; i++) {
        try {
            await sandbox.files.write(remotePath, fileContent);
            console.log(`[E2B] Successfully uploaded file to ${remotePath}`);
            return;
        } catch (err) {
            console.error(`[E2B] Failed to write ${remotePath} (attempt ${i + 1}):`, err.message || err);
            lastErr = err;
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    throw lastErr;
}

/**
 * Deletes a file in the E2B sandbox.
 * Uses sandbox.files API instead of shell commands — more reliable
 * across e2b templates including code-interpreter-v1.
 */
export async function deleteFileInSandbox(sandbox, remotePath) {
    try {
        // Try native files API first (most reliable)
        if (typeof sandbox.files?.remove === 'function') {
            await sandbox.files.remove(remotePath);
        } else {
            // Fallback: write empty + overwrite (caller will re-upload anyway)
            // We don't throw — delete is best-effort before an upload
            console.warn(`[E2B] files.remove not available, skipping delete of ${remotePath}`);
        }
        console.log(`[E2B] Successfully deleted ${remotePath}`);
    } catch (err) {
        // If file doesn't exist, that's fine — we're about to overwrite it
        if (err?.message?.includes('not found') || err?.message?.includes('No such file')) {
            console.warn(`[E2B] File not found, skipping delete: ${remotePath}`);
            return;
        }
        console.error(`[E2B] Failed to delete ${remotePath}:`, err);
        throw err;
    }
}