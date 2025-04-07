import { existsSync, lstatSync, readFileSync, writeFileSync } from "fs";
import { parseTestFile } from "../testFileParsing/testFileParser";
import { TextDocumentHelper } from "../util/textDocumentHelper";
import { RequestFileBlockName } from "../testFileParsing/definitions/requestFileBlockNameEnum";
import { getAllMethodBlocks } from "../testFileParsing/internal/getAllMethodBlocks";
import {
    getLineBreak,
    getNumberOfWhitespacesForIndentation,
} from "./internal/util/writerUtils";
import { MethodBlockBody } from "./internal/methodBlockBodyEnum";
import { MethodBlockAuth } from "./internal/methodBlockAuthEnum";

export function appendDefaultMethodBlock(
    testFilePath: string,
    blockName: RequestFileBlockName
) {
    if (!existsSync(testFilePath) || !lstatSync(testFilePath).isFile()) {
        throw new Error(`No file found for given path '${testFilePath}'`);
    }

    const documentHelper = new TextDocumentHelper(
        readFileSync(testFilePath).toString()
    );

    const allExistingBlocks = parseTestFile(documentHelper).blocks;
    const existingMethodBlocks = getAllMethodBlocks(allExistingBlocks);
    const metaBlock = allExistingBlocks.find(
        ({ name }) => name == RequestFileBlockName.Meta
    );

    if (existingMethodBlocks.length != 0) {
        throw new Error(
            `There already are method blocks defined for request file '${testFilePath}': ${JSON.stringify(
                existingMethodBlocks.map(({ name }) => name),
                null,
                2
            )}`
        );
    } else if (!metaBlock) {
        throw new Error(
            `No '${RequestFileBlockName.Meta}' block found for request file '${testFilePath}'.`
        );
    }

    writeFileSync(
        testFilePath,
        `${documentHelper.getText()}${getLineBreak()}${getLineBreak()}${getTextToAdd(
            blockName
        )}`
    );
}

function getTextToAdd(blockName: RequestFileBlockName) {
    // ToDo: Use linebreak configured in workspace of extension user

    const lineBreak = getLineBreak();
    const whitespacesForIndentation = getNumberOfWhitespacesForIndentation();

    return `${blockName} {`
        .concat(`${lineBreak}${" ".repeat(whitespacesForIndentation)}url:`)
        .concat(
            `${lineBreak}${" ".repeat(whitespacesForIndentation)}body: ${
                MethodBlockBody.None
            }`
        )
        .concat(
            `${lineBreak}${" ".repeat(whitespacesForIndentation)}auth: ${
                MethodBlockAuth.None
            }`
        )
        .concat(`${lineBreak}}`);
}
