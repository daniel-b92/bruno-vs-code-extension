import { normalizePath } from "@global_shared";
import {
    shouldPrefixNamesWithSequence,
    TypedCollectionItemProvider,
} from "@shared";
import { getItemsWithSequence } from "./getItemsWithSequence";

/** Sequences of requests, app files and folders by their normalized paths. */
export type SequencesByPath = ReadonlyMap<string, number>;

/**
 * Has to be called before changing sequences within the given folders, to recognize outdated prefixes afterwards (see `syncSequencePrefixes`).
 * Returns no sequences if prefixing names with the sequence is not enabled in the settings, since they are not needed then.
 */
export async function getSequencesBeforeChange(
    itemProvider: TypedCollectionItemProvider,
    folderPaths: string[],
): Promise<SequencesByPath> {
    const sequences = new Map<string, number>();

    if (!shouldPrefixNamesWithSequence()) {
        return sequences;
    }

    for (const folderPath of new Set(folderPaths)) {
        for (const { path, sequence } of await getItemsWithSequence(
            itemProvider,
            folderPath,
        )) {
            sequences.set(normalizePath(path), sequence);
        }
    }

    return sequences;
}

/** The name of a copied item starts with the prefix of the original item until it is renamed. */
export function addSequenceOfCopiedItem(
    sequences: SequencesByPath,
    originalPath: string,
    pathOfCopy: string,
): SequencesByPath {
    const originalSequence = sequences.get(normalizePath(originalPath));

    return originalSequence === undefined
        ? sequences
        : new Map([
              ...sequences,
              [normalizePath(pathOfCopy), originalSequence],
          ]);
}
