import { BrunoFileType, ItemType, parseSequenceFromFile } from "@global_shared";
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
    const isRequestOrAppFile =
        fileType == BrunoFileType.RequestFile ||
        fileType == BrunoFileType.AppFile;
    // Has to be read before the existing file is overwritten.
    const replacedSequence =
        overwrite && isRequestOrAppFile
            ? await parseSequenceFromFile(newPath)
            : undefined;
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

    if (isRequestOrAppFile) {
        // Only when moving a request or app file, sequences of requests and app files may need to be adjusted
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
            replacedSequence,
        );
    }

    await syncSequencePrefixes(itemProvider, affectedFolders, {
        logger,
        previousSequences,
        // The collection data may not know the moved file at its new location yet.
        previousRenames: [{ sourcePath, targetPath: newPath, isFile: true }],
    });
}
