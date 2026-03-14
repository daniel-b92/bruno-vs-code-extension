export function convertToGlobPattern(path: string, removeTrailingSlash = true) {
    const normalized = path.replace(/\\/g, "/");

    return removeTrailingSlash && normalized.endsWith("/")
        ? normalized.slice(0, -1)
        : normalized;
}
