import { existsSync, lstatSync, readFileSync, writeFileSync } from "fs";
import { parseTestFile } from "../testFileParsing/testFileParser";
import { TextDocumentHelper } from "../util/textDocumentHelper";
import { RequestFileBlockName } from "../testFileParsing/definitions/requestFileBlockNameEnum";
import { basename, dirname, extname } from "path";
import { Collection } from "../../model/collection";
import { CollectionFile } from "../../model/collectionFile";

export function addMetaBlock(collection: Collection, testFilePath: string) {
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
            ? getDefaultMetaBlock(collection, testFilePath)
            : `${getDefaultMetaBlock(collection, testFilePath)}
        
${documentHelper.getText()}`
    );
}

function getDefaultMetaBlock(collection: Collection, filePath: string) {
    // ToDo: Use linebreak configured in workspace of extension user
    const existingSequences = collection
        .getAllStoredDataForCollection()
        .filter(
            ({ item }) =>
                item instanceof CollectionFile &&
                dirname(item.getPath()) == dirname(filePath) &&
                item.getSequence() != undefined
        )
        .map(({ item }) => (item as CollectionFile).getSequence() as number);

    return `meta {
  name: ${basename(filePath).substring(
      0,
      basename(filePath).indexOf(extname(filePath))
  )}
  type: http
  seq: ${Math.max(...existingSequences) + 1}
}`;
}
