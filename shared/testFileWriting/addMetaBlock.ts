import { basename, dirname, extname } from "path";
import {
    RequestType,
    parseBruFile,
    RequestFileBlockName,
    Collection,
    CollectionFile,
    MetaBlockContent,
    TextDocumentHelper,
    checkIfPathExistsAsync,
    getLineBreak,
} from "..";
import { getNumberOfWhitespacesForIndentation } from "./internal/writerUtils";
import { promisify } from "util";
import { lstat, readFile, writeFile } from "fs";

export async function addMetaBlock(
    collection: Collection,
    testFilePath: string,
    requestType: RequestType,
) {
    if (
        !(await checkIfPathExistsAsync(testFilePath)) ||
        !(await promisify(lstat)(testFilePath)).isFile()
    ) {
        throw new Error(`No file found for given path '${testFilePath}'`);
    }

    const documentHelper = new TextDocumentHelper(
        await promisify(readFile)(testFilePath, "utf-8"),
    );

    if (
        parseBruFile(documentHelper).blocks.some(
            ({ name }) => name == RequestFileBlockName.Meta,
        )
    ) {
        throw new Error(
            `'${RequestFileBlockName.Meta}' block already exists for request file '${testFilePath}'`,
        );
    }

    await promisify(writeFile)(
        testFilePath,
        documentHelper.getLineCount() == 0
            ? mapContentToText(
                  testFilePath,
                  getContent(collection, testFilePath, requestType),
              )
            : `${mapContentToText(
                  testFilePath,
                  getContent(collection, testFilePath, requestType),
              )}
        
${documentHelper.getText()}`,
    );
}

function getContent(
    collection: Collection,
    testFilePath: string,
    requestType: RequestType,
): MetaBlockContent {
    const existingSequences = collection
        .getAllStoredDataForCollection()
        .filter(
            ({ item }) =>
                item instanceof CollectionFile &&
                dirname(item.getPath()) == dirname(testFilePath) &&
                item.getSequence() != undefined,
        )
        .map(({ item }) => (item as CollectionFile).getSequence() as number);

    return {
        name: basename(testFilePath).substring(
            0,
            basename(testFilePath).indexOf(extname(testFilePath)),
        ),
        type: requestType,
        sequence: Math.max(...existingSequences) + 1,
    };
}

function mapContentToText(
    filePath: string,
    { name, type, sequence }: MetaBlockContent,
) {
    const lineBreak = getLineBreak(filePath);
    const whitespacesForIndentation = getNumberOfWhitespacesForIndentation();

    return `${RequestFileBlockName.Meta} {`
        .concat(
            `${lineBreak}${" ".repeat(whitespacesForIndentation)}name: ${name}`,
        )
        .concat(
            `${lineBreak}${" ".repeat(whitespacesForIndentation)}type: ${type}`,
        )
        .concat(
            `${lineBreak}${" ".repeat(
                whitespacesForIndentation,
            )}seq: ${sequence}`,
        )
        .concat(`${lineBreak}}`);
}
