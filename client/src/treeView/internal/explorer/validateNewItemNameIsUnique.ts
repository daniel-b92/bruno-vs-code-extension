import { basename } from "path";
import { checkIfPathExistsAsync, normalizePath } from "@global_shared";
import { promisify } from "util";
import { lstat } from "fs";

export async function validateNewItemNameIsUnique(
    newItemPath: string,
    originalItemPath?: string,
) {
    if (
        !(await checkIfPathExistsAsync(newItemPath)) ||
        (originalItemPath &&
            normalizePath(newItemPath) == normalizePath(originalItemPath))
    ) {
        return undefined;
    }

    const isFile = await promisify(lstat)(newItemPath)
        .then((stats) => stats.isFile())
        .catch(() => undefined);

    if (isFile === undefined) {
        return undefined;
    }

    return `${
        isFile ? "File" : "Folder"
    } with name '${basename(newItemPath)}' already exists`;
}
