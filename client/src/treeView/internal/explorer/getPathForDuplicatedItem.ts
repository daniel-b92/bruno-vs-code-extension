import { lstat } from "fs";
import { basename, extname } from "path";
import { promisify } from "util";
import { checkIfPathExistsAsync } from "@global_shared";

export async function getPathForDuplicatedItem(originalPath: string) {
    const maxAttempts = 100;
    const basePath = await getBasePathForNewItem(originalPath, "_Copy");

    if (basePath === undefined) {
        return undefined;
    }

    let newPath = basePath;
    let attempts = 1;

    while ((await checkIfPathExistsAsync(newPath)) && attempts < maxAttempts) {
        const maybeNewPath = await getBasePathForNewItem(
            basePath,
            attempts.toString(),
        );

        if (maybeNewPath === undefined) {
            return undefined;
        }

        newPath = maybeNewPath;
        attempts++;
    }

    if (await checkIfPathExistsAsync(newPath)) {
        throw new Error(
            `Did not manage to find new path for item path '${originalPath}' to duplicate within ${maxAttempts} attempts!`,
        );
    }
    return newPath;
}

async function getBasePathForNewItem(path: string, toAppend: string) {
    const isDirectory = await promisify(lstat)(path)
        .then((stats) => stats.isDirectory())
        .catch(() => undefined);

    if (isDirectory === undefined) {
        return undefined;
    }

    return isDirectory
        ? `${path}${toAppend}`
        : path.replace(
              basename(path),
              `${basename(path).replace(extname(path), "")}${toAppend}${extname(
                  path,
              )}`,
          );
}
