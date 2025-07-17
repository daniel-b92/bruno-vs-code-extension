import { lstat } from "fs";
import { basename, extname } from "path";
import { promisify } from "util";
import { checkIfPathExistsAsync } from "../../../shared";

export async function getPathForDuplicatedItem(originalPath: string) {
    const maxAttempts = 100;
    const basePath = await getBasePathForNewItem(originalPath, "_Copy");
    let newPath = basePath;
    let attempts = 1;

    while ((await checkIfPathExistsAsync(newPath)) && attempts < maxAttempts) {
        newPath = await getBasePathForNewItem(basePath, attempts.toString());
        attempts++;
    }

    if (await checkIfPathExistsAsync(newPath)) {
        throw new Error(
            `Did not manage to find new path for item path '${originalPath}' to duplicate within ${maxAttempts} attempts!`
        );
    }
    return newPath;
}

async function getBasePathForNewItem(path: string, toAppend: string) {
    return (await promisify(lstat)(path)).isDirectory()
        ? `${path}${toAppend}`
        : path.replace(
              basename(path),
              `${basename(path).replace(extname(path), "")}${toAppend}${extname(
                  path
              )}`
          );
}
