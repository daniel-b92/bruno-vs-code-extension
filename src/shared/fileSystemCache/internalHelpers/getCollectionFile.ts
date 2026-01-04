import { promisify } from "util";
import {
    Collection,
    BrunoRequestFile,
    getItemType,
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
    parseBlockFromFile,
    RequestFileBlockName,
    isDictionaryBlockField,
    MetaBlockKey,
    isDictionaryBlockArrayField,
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
            return createRequestFileInstance(path);
        case NonBrunoSpecificItemType.OtherFileType:
            return new NonBrunoFile(path);
    }
}

async function createEnvironmentFileInstance(path: string) {
    const fileContent = await promisify(readFile)(path, {
        encoding: "utf-8",
    }).catch(() => undefined);

    if (fileContent === undefined) {
        return undefined;
    }

    const varsBlocks = parseBruFile(
        new TextDocumentHelper(fileContent),
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

async function createRequestFileInstance(path: string) {
    const fileContent = await promisify(readFile)(path, {
        encoding: "utf-8",
    }).catch(() => undefined);

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

    const sequenceField = metaBlockContent.find(
        ({ key }) => key == MetaBlockKey.Sequence,
    );
    const tagsField = metaBlockContent.find(
        ({ key }) => key == MetaBlockKey.Tags,
    );

    return new BrunoRequestFile(
        path,
        sequenceField &&
        isDictionaryBlockSimpleField(sequenceField) &&
        !isNaN(Number(sequenceField.value))
            ? Number(sequenceField.value)
            : undefined,
        tagsField && isDictionaryBlockArrayField(tagsField)
            ? tagsField.values.map(({ content }) => content)
            : undefined,
    );
}
