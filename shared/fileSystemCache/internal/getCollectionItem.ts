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
    MetaBlockKey,
    isDictionaryBlockArrayField,
    Collection,
    BrunoRequestFile,
    BrunoFileType,
    BrunoEnvironmentFile,
    NonBrunoSpecificItemType,
    NonBrunoFile,
    getItemType,
    DictionaryBlockSimpleField,
    Block,
    DictionaryBlockArrayField,
    getValidDictionaryBlocksWithName,
    CollectionDirectory,
    getFolderSettingsFilePath,
} from "../..";
import { readFile } from "fs";
import { dirname } from "path";

export async function getCollectionItem<T>(
    collection: Collection<T>,
    path: string,
    includeAdditionalData = false,
) {
    const itemType = await getItemType(collection, path);

    if (!itemType) {
        return undefined;
    }

    switch (itemType) {
        case NonBrunoSpecificItemType.Directory:
            return await createCollectionDirectoryInstance(
                path,
                includeAdditionalData,
                await getFolderSettingsFilePath(path),
            );
        case BrunoFileType.CollectionSettingsFile:
        case BrunoFileType.FolderSettingsFile:
            return await createCollectionDirectoryInstance(
                dirname(path),
                includeAdditionalData,
                path,
            );
        case BrunoFileType.EnvironmentFile:
            return await createEnvironmentFileInstance(path);
        case BrunoFileType.RequestFile:
            return await createRequestFileInstance(path, includeAdditionalData);
        case NonBrunoSpecificItemType.OtherFileType:
            return new NonBrunoFile(path);
    }
}

async function createCollectionDirectoryInstance(
    folderPath: string,
    includeAdditionalData: boolean,
    folderSettingsFilePath?: string,
) {
    if (!folderSettingsFilePath) {
        return new CollectionDirectory(folderPath);
    }

    if (!includeAdditionalData) {
        const settingsContent = await getFileContent(folderSettingsFilePath);

        if (settingsContent === undefined) {
            return undefined;
        }

        const metaBlockContent = parseBlockFromFile(
            new TextDocumentHelper(settingsContent),
            RequestFileBlockName.Meta,
        );

        const isDictionaryBlock =
            Array.isArray(metaBlockContent) &&
            metaBlockContent.every((field) => isDictionaryBlockField(field));

        if (!isDictionaryBlock) {
            return new CollectionDirectory(folderPath);
        }

        const { sequence } = getSequenceAndTagsFromMetaBlock(metaBlockContent);
        return new CollectionDirectory(folderPath, sequence);
    }

    const settingsFileBlocks = await parseFile(folderSettingsFilePath);
    const metaBlocks = settingsFileBlocks
        ? getValidDictionaryBlocksWithName(
              settingsFileBlocks,
              RequestFileBlockName.Meta,
          )
        : [];

    if (
        !settingsFileBlocks ||
        metaBlocks.length != 1 ||
        !Array.isArray(metaBlocks[0].content) ||
        metaBlocks[0].content.some((field) => !isDictionaryBlockField(field))
    ) {
        return new CollectionDirectory(folderPath);
    }

    const { sequence } = getSequenceAndTagsFromMetaBlock(metaBlocks[0].content);

    const variables = settingsFileBlocks
        ? getAllVariablesFromBlocks(settingsFileBlocks)
        : [];
    return new CollectionDirectory(folderPath, sequence, variables);
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

async function createRequestFileInstance(
    path: string,
    includeAdditionalData: boolean,
) {
    if (!includeAdditionalData) {
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

    const blocks = await parseFile(path);
    const metaBlocks = blocks
        ? getValidDictionaryBlocksWithName(blocks, RequestFileBlockName.Meta)
        : [];

    if (
        !blocks ||
        metaBlocks.length != 1 ||
        !Array.isArray(metaBlocks[0].content) ||
        metaBlocks[0].content.some((field) => !isDictionaryBlockField(field))
    ) {
        return new BrunoRequestFile(path);
    }

    const { sequence, tags } = getSequenceAndTagsFromMetaBlock(
        metaBlocks[0].content,
    );
    return new BrunoRequestFile(
        path,
        sequence,
        tags,
        getAllVariablesFromBlocks(blocks),
    );
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

function getSequenceAndTagsFromMetaBlock(
    fields: (DictionaryBlockSimpleField | DictionaryBlockArrayField)[],
) {
    const sequenceField = fields.find(
        ({ key, disabled }) => key == MetaBlockKey.Sequence && !disabled,
    );
    const tagsField = fields.find(
        ({ key, disabled }) => key == MetaBlockKey.Tags && !disabled,
    );

    return {
        sequence:
            sequenceField &&
            isDictionaryBlockSimpleField(sequenceField) &&
            !isNaN(Number(sequenceField.value))
                ? Number(sequenceField.value)
                : undefined,
        tags:
            tagsField && isDictionaryBlockArrayField(tagsField)
                ? tagsField.values.map(({ content }) => content)
                : undefined,
    };
}

function getAllVariablesFromBlocks(blocks: Block[]) {
    return blocks.flatMap(({ variableReferences }) => variableReferences ?? []);
}
