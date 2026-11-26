import { CollectionItem, Logger } from "@global_shared";
import { TypedCollectionItemProvider } from "@shared";
import { getPathAfterRenames } from "../runRequestPaths/getEditsForRunRequestPaths";
import { getFoldersAffectedByFileInsertion } from "../sequencePrefixUtils/getFoldersAffectedByFileInsertion";
import {
    addSequenceOfCopiedItem,
    getSequencesBeforeChange,
} from "../sequencePrefixUtils/getSequencesBeforeChange";
import { syncSequencePrefixes } from "../sequencePrefixUtils/syncSequencePrefixes";
import { handleFileInsertion } from "./handleFileInsertion";
import { FileInsertionPosition } from "./interfaces";

/**
 * @returns The final path of the inserted file or `undefined` if it was not inserted.
 * The path differs from the given one if the file or one of its ancestor folders was renamed to match its sequence.
 */
export async function insertFileAndSyncSequencePrefixes(
    itemProvider: TypedCollectionItemProvider,
    sourceItem: CollectionItem,
    target: { newPath: string; insertionPosition: FileInsertionPosition },
    newContent?: string,
    logger?: Logger,
): Promise<string | undefined> {
    const { newPath } = target;
    const affectedFolders = getFoldersAffectedByFileInsertion(
        itemProvider,
        {
            sourcePath: sourceItem.getPath(),
            newPath,
            // The source item is copied, so its folder is not changed.
            isMoved: false,
        },
        sourceItem.getItemType(),
    );
    const previousSequences = addSequenceOfCopiedItem(
        await getSequencesBeforeChange(itemProvider, affectedFolders),
        sourceItem.getPath(),
        newPath,
    );

    if (
        !(await handleFileInsertion(
            sourceItem,
            target,
            itemProvider,
            newContent,
        ))
    ) {
        return undefined;
    }

    return getPathAfterRenames(
        newPath,
        await syncSequencePrefixes(itemProvider, affectedFolders, {
            logger,
            previousSequences,
            // The inserted file is usually not cached yet, but may call requests that are renamed by the sync.
            uncachedItemPaths: [newPath],
        }),
    );
}
