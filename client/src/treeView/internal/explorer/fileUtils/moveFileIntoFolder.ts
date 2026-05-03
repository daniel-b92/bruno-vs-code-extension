import { BrunoFileType, ItemType } from "@global_shared";
import { TypedCollectionItemProvider } from "../../../../shared";
import { BrunoTreeItem } from "../../../brunoTreeItem";
import { renameFileOrFolder } from "../renameFileOrFolder";
import { showErrorMessageForFailedDragAndDrop } from "../showErrorMessageForFailedDragAndDrop";
import { updateSequencesAfterInsertingRequestFile } from "./updateSequencesAfterInsertingRequestFile";
import { dirname } from "path";
import { RequestFileInsertionPositionType } from "./interfaces";

export async function moveFileIntoFolder(
    itemProvider: TypedCollectionItemProvider,
    sourcePath: string,
    newPath: string,
    target: BrunoTreeItem,
    targetDirectoryForDragAndDrop: string,
    fileType: ItemType,
) {
    const wasSuccessful = await renameFileOrFolder(sourcePath, newPath, true);

    if (!wasSuccessful) {
        showErrorMessageForFailedDragAndDrop(sourcePath);
        return;
    }

    if (fileType == BrunoFileType.RequestFile) {
        // Only when moving a request file, sequences of requests may need to be adjusted
        await updateSequencesAfterInsertingRequestFile(
            itemProvider,
            target.isFile
                ? {
                      item: target,
                      type: RequestFileInsertionPositionType.AfterFile,
                  }
                : RequestFileInsertionPositionType.Folder,
            newPath,
            {
                targetDirectory: targetDirectoryForDragAndDrop,
                otherDirectory: dirname(sourcePath),
            },
        );
    }
}
