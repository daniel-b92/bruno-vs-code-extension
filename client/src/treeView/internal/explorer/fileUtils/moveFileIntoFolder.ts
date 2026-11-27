import { BrunoFileType, ItemType } from "@global_shared";
import { Logger } from "@global_shared";
import { TypedCollectionItemProvider, BrunoTreeItem } from "@shared";
import { renameFileOrFolder } from "../renameFileOrFolder";
import { showErrorMessageForFailedDragAndDrop } from "../showErrorMessageForFailedDragAndDrop";
import { updateSequencesAfterInsertingRequestOrAppFile } from "./updateSequencesAfterInsertingRequestOrAppFile";
import { dirname } from "path";
import { RequestFileInsertionPositionType } from "./interfaces";
import { getFoldersAffectedByFileInsertion } from "../sequencePrefixUtils/getFoldersAffectedByFileInsertion";
import { getSequencesBeforeChange } from "../sequencePrefixUtils/getSequencesBeforeChange";
import { syncSequencePrefixes } from "../sequencePrefixUtils/syncSequencePrefixes";

export async function moveFileIntoFolder(
    itemProvider: TypedCollectionItemProvider,
    sourcePath: string,
    newPath: string,
    target: BrunoTreeItem,
    targetDirectoryForDragAndDrop: string,
    fileType: ItemType,
    logger?: Logger,
    /** Whether an existing item at the new path should be replaced (see `renameFileOrFolder`). */
    overwrite = false,
) {
    const affectedFolders = getFoldersAffectedByFileInsertion(
        itemProvider,
        { sourcePath, newPath, isMoved: true },
        fileType,
    );
    const previousSequences = await getSequencesBeforeChange(
        itemProvider,
        affectedFolders,
    );
    const wasSuccessful = await renameFileOrFolder(
        itemProvider,
        sourcePath,
        newPath,
        true,
        logger,
        overwrite,
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

    await syncSequencePrefixes(itemProvider, affectedFolders, {
        logger,
        previousSequences,
        // The collection data may not know the moved file at its new location yet.
        previousRenames: [{ sourcePath, targetPath: newPath, isFile: true }],
    });
}
