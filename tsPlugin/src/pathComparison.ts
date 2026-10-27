import * as ts from "typescript/lib/tsserverlibrary";

/**
 * File names are compared case insensitively on some platforms (e.g. Windows), so e.g. `C:/folder` and `c:/Folder` are the same folder for the Typescript server.
 */
export function usesCaseSensitiveFileNames(info: ts.server.PluginCreateInfo) {
    // Assume case sensitivity (as the Typescript server does on Linux), if the host does not tell.
    return info.serverHost.useCaseSensitiveFileNames !== false;
}

/**
 * Both paths are expected to use forward slashes and no trailing slash.
 */
export function isPathWithinFolder(
    path: string,
    folder: string,
    caseSensitive: boolean,
) {
    const [comparablePath, comparableFolder] = [path, folder].map((p) =>
        caseSensitive ? p : p.toLowerCase(),
    );

    return (
        comparablePath == comparableFolder ||
        comparablePath.startsWith(`${comparableFolder}/`)
    );
}

export function arePathsEqual(
    first: string,
    second: string,
    caseSensitive: boolean,
) {
    return caseSensitive
        ? first == second
        : first.toLowerCase() == second.toLowerCase();
}
