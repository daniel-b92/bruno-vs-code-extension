import { promisify } from "util";
import {
    Collection,
    BrunoRequestFile,
    getItemType,
    getSequenceForFile,
    BrunoFileType,
    BrunoFolderSettingsFile,
    BrunoEnvironmentFile,
    NonBrunoSpecificItemType,
    NonBrunoFile,
    parseBruFile,
    TextDocumentHelper,
    EnvironmentFileBlockName,
    isBlockDictionaryBlock,
    isDictionaryBlockSimpleField,
} from "../..";
import { readFile } from "fs";

export async function getCollectionFile(collection: Collection, path: string) {
    const itemType = await getItemType(collection, path);

    if (!itemType) {
        throw new Error(`File '${path}' not available on file system.`);
    } else if (itemType == NonBrunoSpecificItemType.Directory) {
        throw new Error(
            `Cannot create collection file for directory '${path}'.`,
        );
    }

    switch (itemType) {
        case BrunoFileType.CollectionSettingsFile:
        case BrunoFileType.FolderSettingsFile:
            return new BrunoFolderSettingsFile(path);
        case BrunoFileType.EnvironmentFile:
            return createEnvironmentFileInstance(path);
        case BrunoFileType.RequestFile:
            return new BrunoRequestFile(
                path,
                await getSequenceForFile(collection, path),
            );
        case NonBrunoSpecificItemType.OtherFileType:
            return new NonBrunoFile(path);
    }
}

async function createEnvironmentFileInstance(path: string) {
    const varsBlocks = parseBruFile(
        new TextDocumentHelper(
            await promisify(readFile)(path, {
                encoding: "utf-8",
            }),
        ),
    ).blocks.filter(({ name }) => name == EnvironmentFileBlockName.Vars);

    if (varsBlocks.length != 1) {
        return new BrunoEnvironmentFile(path, []);
    }

    const varsBlock = varsBlocks[0];

    if (!isBlockDictionaryBlock(varsBlock)) {
        return new BrunoEnvironmentFile(path, []);
    }

    return new BrunoEnvironmentFile(
        path,
        varsBlock.content.filter((field) =>
            isDictionaryBlockSimpleField(field),
        ),
    );
}
