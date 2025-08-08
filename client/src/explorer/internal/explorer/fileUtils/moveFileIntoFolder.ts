import {
    BrunoFileType,
    CollectionItemProvider,
    FileType,
} from "../../../../../../shared";
import { BrunoTreeItem } from "../../../brunoTreeItem";
import { renameFileOrFolder } from "../renameFileOrFolder";
import { showErrorMessageForFailedDragAndDrop } from "../showErrorMessageForFailedDragAndDrop";
import { updateSequencesAfterMovingRequestFile } from "./updateSequencesAfterMovingRequestFile";

export async function moveFileIntoFolder(
    itemProvider: CollectionItemProvider,
    sourcePath: string,
    newPath: string,
    target: BrunoTreeItem,
    targetDirectoryForDragAndDrop: string,
    fileType: FileType,
) {
    const wasSuccessful = await renameFileOrFolder(sourcePath, newPath, true);

    if (!wasSuccessful) {
        showErrorMessageForFailedDragAndDrop(sourcePath);
        return;
    }

    if (fileType == BrunoFileType.RequestFile) {
        // Only when moving a request file, sequences of requests may need to be adjusted
        await updateSequencesAfterMovingRequestFile(
            itemProvider,
            target,
            targetDirectoryForDragAndDrop,
            sourcePath,
        );
    }
}
