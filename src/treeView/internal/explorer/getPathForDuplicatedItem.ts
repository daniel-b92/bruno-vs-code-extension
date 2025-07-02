import { lstatSync, existsSync } from "fs";
import { basename, extname } from "path";

export function getPathForDuplicatedItem(originalPath: string) {
    const getBasePathForNewItem = (path: string, toAppend: string) =>
        lstatSync(path).isDirectory()
            ? `${path}${toAppend}`
            : path.replace(
                  basename(path),
                  `${basename(path).replace(
                      extname(path),
                      ""
                  )}${toAppend}${extname(path)}`
              );

    const maxAttempts = 100;
    const basePath = getBasePathForNewItem(originalPath, "_Copy");
    let newPath = basePath;
    let attempts = 1;

    while (existsSync(newPath) && attempts < maxAttempts) {
        newPath = getBasePathForNewItem(basePath, attempts.toString());
        attempts++;
    }

    if (existsSync(newPath)) {
        throw new Error(
            `Did not manage to find new path for item path '${originalPath}' to duplicate within ${maxAttempts} attempts!`
        );
    }
    return newPath;
}
