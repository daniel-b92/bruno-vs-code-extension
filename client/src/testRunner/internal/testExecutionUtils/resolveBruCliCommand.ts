import { existsSync, statSync } from "fs";
import { dirname, isAbsolute, join, relative, resolve } from "path";

export const globalBruCliCommand = "bru";

export type ResolvedBruCli =
    | { source: "setting" | "localInstall"; command: string }
    | { source: "global"; command: typeof globalBruCliCommand }
    | { source: "invalidSetting"; configuredPath: string };

/**
 * Resolution order:
 * 1. The configured path (absolute or relative to the workspace folder). Does not fall back to other options if the file does not exist.
 * 2. A local install (`node_modules/.bin/bru`), searched from the collection root directory upwards until the workspace folder (inclusive).
 * 3. `bru` from the `PATH`.
 */
export function resolveBruCliCommand({
    configuredPath,
    collectionRootDirectory,
    workspaceFolderPath,
    platform = process.platform,
}: {
    configuredPath?: string;
    collectionRootDirectory: string;
    workspaceFolderPath: string;
    platform?: NodeJS.Platform;
}): ResolvedBruCli {
    const trimmedConfiguredPath = configuredPath?.trim();

    if (trimmedConfiguredPath) {
        const absolutePath = isAbsolute(trimmedConfiguredPath)
            ? trimmedConfiguredPath
            : resolve(workspaceFolderPath, trimmedConfiguredPath);

        return isFile(absolutePath)
            ? { source: "setting", command: absolutePath }
            : {
                  source: "invalidSetting",
                  configuredPath: trimmedConfiguredPath,
              };
    }

    const executableName = platform == "win32" ? "bru.cmd" : "bru";
    const localInstall = findLocalInstall(
        collectionRootDirectory,
        workspaceFolderPath,
        executableName,
    );

    return localInstall
        ? { source: "localInstall", command: localInstall }
        : { source: "global", command: globalBruCliCommand };
}

function findLocalInstall(
    startDirectory: string,
    workspaceFolderPath: string,
    executableName: string,
) {
    if (!isWithinOrEqual(workspaceFolderPath, startDirectory)) {
        // Collection is outside of the workspace folder, so only its own directory is searched.
        return findInDirectory(startDirectory, executableName);
    }

    let current = startDirectory;
    for (;;) {
        const found = findInDirectory(current, executableName);
        if (found) {
            return found;
        }

        const parent = dirname(current);
        if (relative(workspaceFolderPath, current) == "" || parent == current) {
            return undefined;
        }
        current = parent;
    }
}

function findInDirectory(directory: string, executableName: string) {
    const candidate = join(directory, "node_modules", ".bin", executableName);
    return existsSync(candidate) ? candidate : undefined;
}

function isFile(path: string) {
    try {
        return statSync(path).isFile();
    } catch {
        return false;
    }
}

function isWithinOrEqual(parent: string, child: string) {
    const rel = relative(parent, child);
    return rel == "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
