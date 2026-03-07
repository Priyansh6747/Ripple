/**
 * In-memory store for build results.
 *
 * Maps eventId → { sandboxId, url, status, error? }
 *
 * Uses globalThis to ensure a true singleton across all
 * Next.js route bundles (each route gets its own module scope,
 * so a plain module-level Map would create separate instances).
 */

if (!globalThis.__rippleBuildStore) {
    globalThis.__rippleBuildStore = new Map();
}

const builds = globalThis.__rippleBuildStore;

export function setBuild(eventId, data) {
    builds.set(eventId, { ...data, updatedAt: Date.now() });
}

export function getBuild(eventId) {
    return builds.get(eventId) ?? null;
}

export default builds;
