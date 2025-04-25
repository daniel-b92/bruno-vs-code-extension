import { existsSync, lstatSync, readFileSync, writeFileSync } from "fs";
import { parseTestFile } from "../testFileParsing/testFileParser";
import { TextDocumentHelper } from "../fileSystem/util/textDocumentHelper";
import { RequestFileBlockName } from "../languageUtils/requestFileBlockNameEnum";
import { basename, dirname, extname } from "path";
import { Collection } from "../model/collection";
import { CollectionFile } from "../model/collectionFile";
import { MetaBlockContent } from "./interfaces";
import { RequestType } from "../languageUtils/metaBlock/requestTypeEnum";
import {
    getLineBreak,
    getNumberOfWhitespacesForIndentation,
} from "./internal/writerUtils";

export function addMetaBlock(
    collection: Collection,
    testFilePath: string,
    requestType: RequestType
) {
    if (!existsSync(testFilePath) || !lstatSync(testFilePath).isFile()) {
        throw new Error(`No file found for given path '${testFilePath}'`);
    }

    const documentHelper = new TextDocumentHelper(
        readFileSync(testFilePath).toString()
    );

    if (
        parseTestFile(documentHelper).blocks.some(
            ({ name }) => name == RequestFileBlockName.Meta
        )
    ) {
        throw new Error(
            `'${RequestFileBlockName.Meta}' block already exists for request file '${testFilePath}'`
        );
    }

    writeFileSync(
        testFilePath,
        documentHelper.getLineCount() == 0
            ? mapContentToText(
                  getContent(collection, testFilePath, requestType)
              )
            : `${mapContentToText(
                  getContent(collection, testFilePath, requestType)
              )}
        
${documentHelper.getText()}`
    );
}

function getContent(
    collection: Collection,
    testFilePath: string,
    requestType: RequestType
): MetaBlockContent {
    const existingSequences = collection
        .getAllStoredDataForCollection()
        .filter(
            ({ item }) =>
                item instanceof CollectionFile &&
                dirname(item.getPath()) == dirname(testFilePath) &&
                item.getSequence() != undefined
        )
        .map(({ item }) => (item as CollectionFile).getSequence() as number);

    return {
        name: basename(testFilePath).substring(
            0,
            basename(testFilePath).indexOf(extname(testFilePath))
        ),
        type: requestType,
        sequence: Math.max(...existingSequences) + 1,
    };
}

function mapContentToText({ name, type, sequence }: MetaBlockContent) {
    // ToDo: Use linebreak configured in workspace of extension user

    const lineBreak = getLineBreak();
    const whitespacesForIndentation = getNumberOfWhitespacesForIndentation();

    return `${RequestFileBlockName.Meta} {`
        .concat(
            `${lineBreak}${" ".repeat(whitespacesForIndentation)}name: ${name}`
        )
        .concat(
            `${lineBreak}${" ".repeat(whitespacesForIndentation)}type: ${type}`
        )
        .concat(
            `${lineBreak}${" ".repeat(
                whitespacesForIndentation
            )}seq: ${sequence}`
        )
        .concat(`${lineBreak}}`);
}
