import { normalizePath } from "./normalizeDirectoryPath";

/**
 * Checks whether the given path is the given directory itself or located somewhere below it.
 * Sibling directories that merely share a name prefix (e.g. `/foo` and `/foobar`) are not matched.
 */
export function isPathEqualOrDescendant(path: string, directory: string) {
    return normalizePath(path).startsWith(normalizePath(directory));
}
