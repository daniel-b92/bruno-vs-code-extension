import { basename, dirname } from "path";
import {
    BrunoFileType,
    CollectionDirectory,
    isCollectionItemWithSequence,
    isPathEqualOrDescendant,
    normalizePath,
    NonBrunoSpecificItemType,
} from "@global_shared";
import { TypedCollectionItemProvider } from "../../../shared";
import { replaceSequenceForFile } from "./fileUtils/replaceSequenceForFile";

type SequenceEntry = {
    filePath: string;
    name: string;
    sequence: number;
};

export async function normalizeSequencesRecursively(
    itemProvider: TypedCollectionItemProvider,
    folderPath: string,
    collectionRootPath: string,
    sequenceStep: number,
) {
    const collection = itemProvider.getAncestorCollectionForPath(folderPath);
    if (
        !collection ||
        normalizePath(collection.getRootDirectory()) !==
            normalizePath(collectionRootPath)
    ) {
        return;
    }

    const requestGroups = new Map<string, SequenceEntry[]>();
    const folderGroups = new Map<string, SequenceEntry[]>();

    for (const { item } of collection.getAllStoredDataForCollection()) {
        const itemPath = item.getPath();
        const parentPath = dirname(itemPath);
        if (!isPathEqualOrDescendant(parentPath, folderPath)) {
            continue;
        }

        const itemCollection =
            itemProvider.getAncestorCollectionForPath(itemPath);
        if (
            !itemCollection ||
            normalizePath(itemCollection.getRootDirectory()) !==
                normalizePath(collectionRootPath)
        ) {
            continue;
        }

        const sequence = isCollectionItemWithSequence(item)
            ? item.getSequence()
            : undefined;
        if (sequence == undefined) {
            continue;
        }

        const itemType = item.getItemType();
        if (
            itemType === BrunoFileType.RequestFile ||
            itemType === BrunoFileType.AppFile
        ) {
            addToGroup(requestGroups, parentPath, {
                filePath: itemPath,
                name: basename(itemPath),
                sequence,
            });
        } else if (
            itemType === NonBrunoSpecificItemType.Directory &&
            item instanceof CollectionDirectory
        ) {
            const settingsFilePath = item.getSettingsFilePath();
            if (settingsFilePath) {
                addToGroup(folderGroups, parentPath, {
                    filePath: settingsFilePath,
                    name: basename(itemPath),
                    sequence,
                });
            }
        }
    }

    await normalizeGroups(requestGroups, sequenceStep);
    await normalizeGroups(folderGroups, sequenceStep);
}

function addToGroup(
    groups: Map<string, SequenceEntry[]>,
    parentPath: string,
    entry: SequenceEntry,
) {
    const group = groups.get(parentPath) ?? [];
    group.push(entry);
    groups.set(parentPath, group);
}

async function normalizeGroups(
    groups: Map<string, SequenceEntry[]>,
    sequenceStep: number,
) {
    for (const entries of groups.values()) {
        entries.sort(
            (a, b) =>
                a.sequence - b.sequence || a.name.localeCompare(b.name),
        );

        for (const [index, entry] of entries.entries()) {
            const newSequence = (index + 1) * sequenceStep;
            if (entry.sequence !== newSequence) {
                await replaceSequenceForFile(entry.filePath, newSequence);
            }
        }
    }
}
