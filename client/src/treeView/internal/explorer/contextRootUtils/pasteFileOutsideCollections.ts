import { copyFile, writeFile } from "fs/promises";
import { window } from "vscode";

/**
 * Creates the file at the target path with the given content, or as a copy of the source file if there is no content.
 * Returns whether it was successful.
 */
export async function pasteFileOutsideCollections(
    sourcePath: string,
    targetPath: string,
    content?: string,
) {
    try {
        if (content === undefined) {
            await copyFile(sourcePath, targetPath);
        } else {
            await writeFile(targetPath, content);
        }
        return true;
    } catch {
        window.showErrorMessage(`An unexpected error occured.`);
        return false;
    }
}
