import { basename } from "path";
import { checkIfPathExistsAsync } from "@global_shared";
import { promisify } from "util";
import { lstat } from "fs";

export async function validateNewItemNameIsUnique(
    newItemPath: string,
    originalItemPath?: string,
) {
    if (
        !(await checkIfPathExistsAsync(newItemPath)) ||
        (originalItemPath && newItemPath == originalItemPath)
    ) {
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

    return undefined;
}
