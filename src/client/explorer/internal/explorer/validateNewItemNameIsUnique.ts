import { basename } from "path";
import { checkIfPathExistsAsync } from "../../../../shared";
import { promisify } from "util";
import { lstat } from "fs";

export async function validateNewItemNameIsUnique(
    newItemPath: string,
    originalItemPath?: string
) {
    return (await checkIfPathExistsAsync(newItemPath)) &&
        (!originalItemPath || newItemPath != originalItemPath)
        ? `${
              (await promisify(lstat)(newItemPath)).isFile() ? "File" : "Folder"
          } with name '${basename(newItemPath)}' already exists`
        : undefined;
}
