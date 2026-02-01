import { basename } from "path";
import { window } from "vscode";

export function showErrorMessageForFailedDragAndDrop(sourcePath: string) {
    window.showErrorMessage(
        `An unexpected error occured while trying to move item '${basename(
            sourcePath
        )}'.`
    );
}
