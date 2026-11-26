import { lstat } from "fs/promises";
import { basename, extname } from "path";
import { checkIfPathExistsAsync } from "@global_shared";

/**
 * @param isNameUsedBySibling For names that cannot be used, even though the path does not exist (see `getCheckForNamesOfDuplicatedItem`).
 */
export async function getPathForDuplicatedItem(
    originalPath: string,
    isNameUsedBySibling: (name: string) => boolean = () => false,
) {
    const maxAttempts = 100;
    const stats = await lstat(originalPath).catch(() => undefined);

    if (stats === undefined) {
        return undefined;
    }

    const isDirectory = stats.isDirectory();
    const isTaken = async (path: string) =>
        isNameUsedBySibling(basename(path)) ||
        (await checkIfPathExistsAsync(path));
    const basePath = getBasePathForNewItem(originalPath, "_Copy", isDirectory);

    let newPath = basePath;
    let attempts = 1;

    while ((await isTaken(newPath)) && attempts < maxAttempts) {
        newPath = getBasePathForNewItem(
            basePath,
            attempts.toString(),
            isDirectory,
        );
        attempts++;
    }

    if (await isTaken(newPath)) {
        throw new Error(
            `Did not manage to find new path for item path '${originalPath}' to duplicate within ${maxAttempts} attempts!`,
        );
    }
    return newPath;
}

function getBasePathForNewItem(
    path: string,
    toAppend: string,
    isDirectory: boolean,
) {
    return isDirectory
        ? `${path}${toAppend}`
        : path.replace(
              basename(path),
              `${basename(path).replace(extname(path), "")}${toAppend}${extname(
                  path,
              )}`,
          );
}
