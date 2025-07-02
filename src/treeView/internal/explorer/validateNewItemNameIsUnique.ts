import { existsSync, lstatSync } from "fs";
import { basename } from "path";

export function validateNewItemNameIsUnique(
    newItemPath: string,
    originalItemPath?: string
) {
    return existsSync(newItemPath) &&
        (!originalItemPath || newItemPath != originalItemPath)
        ? `${
              lstatSync(newItemPath).isFile() ? "File" : "Folder"
          } with name '${basename(newItemPath)}' already exists`
        : undefined;
}
