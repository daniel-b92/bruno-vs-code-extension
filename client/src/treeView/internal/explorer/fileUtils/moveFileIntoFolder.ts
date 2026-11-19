import { BrunoFileType, ItemType } from "@global_shared";
import { Logger } from "@global_shared";
import { TypedCollectionItemProvider, BrunoTreeItem } from "@shared";
import { renameFileOrFolder } from "../renameFileOrFolder";
import { showErrorMessageForFailedDragAndDrop } from "../showErrorMessageForFailedDragAndDrop";
import { updateSequencesAfterInsertingRequestOrAppFile } from "./updateSequencesAfterInsertingRequestOrAppFile";
import { dirname } from "path";
import { RequestFileInsertionPositionType } from "./interfaces";

export async function moveFileIntoFolder(
    itemProvider: TypedCollectionItemProvider,
    sourcePath: string,
    newPath: string,
    target: BrunoTreeItem,
    targetDirectoryForDragAndDrop: string,
    fileType: ItemType,
    logger?: Logger,
) {
    const wasSuccessful = await renameFileOrFolder(
        itemProvider,
        sourcePath,
        newPath,
        true,
        logger,
    );

    if (!wasSuccessful) {
        showErrorMessageForFailedDragAndDrop(sourcePath);
        return;
    }

    if (fileType == BrunoFileType.RequestFile) {
        // Only when moving a request file, sequences of requests may need to be adjusted
        await updateSequencesAfterInsertingRequestOrAppFile(
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
