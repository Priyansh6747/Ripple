import { Sandbox } from "e2b";

/**
 * Downloads a file from the E2B sandbox.
 */
export async function downloadFileFromSandbox(sandbox, remotePath) {
    try {
        const content = await sandbox.files.read(remotePath);
        // Depending on e2b version, content could be string or Uint8Array.
        if (typeof content === 'string') {
            return content;
        } else if (content instanceof Uint8Array || Buffer.isBuffer(content)) {
            return new TextDecoder().decode(content);
        }
        return String(content);
    } catch (err) {
        console.error(`[E2B] Failed to read ${remotePath}:`, err);
        throw err;
    }
}

/**
 * Uploads (or overwrites) a file in the E2B sandbox.
 */
export async function uploadFileToSandbox(sandbox, remotePath, fileContent) {
    try {
        // fileContent should be a string (e.g. JSON.stringify result)
        await sandbox.files.write(remotePath, fileContent);
        console.log(`[E2B] Successfully uploaded file to ${remotePath}`);
    } catch (err) {
        console.error(`[E2B] Failed to write ${remotePath}:`, err);
        throw err;
    }
}

/**
 * Deletes a file in the E2B sandbox.
 */
export async function deleteFileInSandbox(sandbox, remotePath) {
    try {
        // We can use sandbox.commands.run to remove the file, 
        // since e2b sandbox.files.remove might not be in all API versions or named differently.
        await sandbox.commands.run(`rm -f ${remotePath}`);
        console.log(`[E2B] Successfully deleted ${remotePath}`);
    } catch (err) {
        console.error(`[E2B] Failed to delete ${remotePath}:`, err);
        throw err;
    }
}
