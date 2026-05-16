import { promisify } from "util";
import {
    parseBruFile,
    TextDocumentHelper,
    EnvironmentFileBlockName,
    isBlockDictionaryBlock,
    isDictionaryBlockSimpleField,
    parseBlockFromFile,
    RequestFileBlockName,
    isDictionaryBlockField,
    Collection,
    BrunoRequestFile,
    BrunoFileType,
    BrunoEnvironmentFile,
    NonBrunoSpecificItemType,
    NonBrunoFile,
    DictionaryBlockSimpleField,
    getFolderSettingsFilePath,
    BrunoFolderSettingsFile,
    getSequenceAndTagsFromMetaBlock,
    ItemType,
    CollectionItem,
} from "../..";
import { readFile } from "fs";
import { createCollectionDirectoryInstance } from "./createCollectionDirectoryInstance";

export async function getCollectionItem<T>(
    collection: Collection<T>,
    data: { path: string; itemType: ItemType },
) {
    const { itemType, path } = data;

    switch (itemType) {
        case NonBrunoSpecificItemType.Directory:
            return await createCollectionDirectoryInstance(
                path,
                await getFolderSettingsFilePath(
                    collection.isRootDirectory(path),
                    path,
                ),
            );
        default:
            return await getCollectionItemForFile(path, itemType);
    }
}

export async function getCollectionItemForFile(
    path: string,
    itemType: ItemType,
): Promise<CollectionItem | undefined> {
    switch (itemType) {
        case BrunoFileType.CollectionSettingsFile:
        case BrunoFileType.FolderSettingsFile:
            return new BrunoFolderSettingsFile(path);
        case BrunoFileType.EnvironmentFile:
            return await createEnvironmentFileInstance(path);
        case BrunoFileType.RequestFile:
            return await createRequestFileInstance(path);
        case NonBrunoSpecificItemType.OtherFileType:
            return new NonBrunoFile(path);
        default:
            return undefined;
    }
}

async function createEnvironmentFileInstance(path: string) {
    const blocks = await parseFile(path);

    const varsBlocks = blocks
        ? blocks.filter(({ name }) => name == EnvironmentFileBlockName.Vars)
        : undefined;

    if (!varsBlocks || varsBlocks.length != 1) {
        return new BrunoEnvironmentFile(path, []);
    }

    const varsBlock = varsBlocks[0];

    if (!isBlockDictionaryBlock(varsBlock)) {
        return new BrunoEnvironmentFile(path, []);
    }

    return new BrunoEnvironmentFile(
        path,
        varsBlock.content.filter(
            (field) => isDictionaryBlockSimpleField(field) && !field.disabled,
        ) as DictionaryBlockSimpleField[],
    );
}

async function createRequestFileInstance(path: string) {
    const fileContent = await getFileContent(path);

    if (fileContent === undefined) {
        return undefined;
    }

    const metaBlockContent = parseBlockFromFile(
        new TextDocumentHelper(fileContent),
        RequestFileBlockName.Meta,
    );

    const isDictionaryBlock =
        Array.isArray(metaBlockContent) &&
        metaBlockContent.every((field) => isDictionaryBlockField(field));

    if (!isDictionaryBlock) {
        return new BrunoRequestFile(path);
    }

    const { sequence, tags } =
        getSequenceAndTagsFromMetaBlock(metaBlockContent);
    return new BrunoRequestFile(path, sequence, tags);
}

async function parseFile(path: string) {
    const content = await getFileContent(path);

    return content
        ? parseBruFile(new TextDocumentHelper(content)).blocks
        : undefined;
}

async function getFileContent(path: string) {
    return await promisify(readFile)(path, {
        encoding: "utf-8",
    }).catch(() => undefined);
}
