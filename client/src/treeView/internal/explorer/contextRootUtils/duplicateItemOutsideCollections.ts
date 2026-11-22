import { cp } from "fs/promises";
import { window } from "vscode";

/** Copies the file or folder (recursively) to the new path. Returns whether it was successful. */
export async function duplicateItemOutsideCollections(
    originalPath: string,
    newPath: string,
) {
    try {
        await cp(originalPath, newPath, {
            recursive: true,
            force: false,
            errorOnExist: true,
        });
        return true;
    } catch {
        window.showErrorMessage(`An unexpected error occured.`);
        return false;
    }
}
