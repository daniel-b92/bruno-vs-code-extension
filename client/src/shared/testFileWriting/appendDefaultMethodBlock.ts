import { getNumberOfWhitespacesForIndentation } from "./internal/writerUtils";
import {
    getAllMethodBlocks,
    MethodBlockAuth,
    MethodBlockBody,
    parseBruFile,
    TextDocumentHelper,
    RequestFileBlockName,
    checkIfPathExistsAsync,
    getLineBreak,
} from "../../../../shared";
import { promisify } from "util";
import { lstat, readFile, writeFile } from "fs";

export async function appendDefaultMethodBlock(
    testFilePath: string,
    blockName: RequestFileBlockName,
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

    const allExistingBlocks = parseBruFile(documentHelper).blocks;
    const existingMethodBlocks = getAllMethodBlocks(allExistingBlocks);
    const metaBlock = allExistingBlocks.find(
        ({ name }) => name == RequestFileBlockName.Meta,
    );

    if (existingMethodBlocks.length != 0) {
        throw new Error(
            `There already are method blocks defined for request file '${testFilePath}': ${JSON.stringify(
                existingMethodBlocks.map(({ name }) => name),
                null,
                2,
            )}`,
        );
    } else if (!metaBlock) {
        throw new Error(
            `No '${RequestFileBlockName.Meta}' block found for request file '${testFilePath}'.`,
        );
    }

    const lineBreak = getLineBreak(testFilePath);

    await promisify(writeFile)(
        testFilePath,
        `${documentHelper.getText()}${lineBreak}${lineBreak}${getTextToAdd(
            lineBreak,
            blockName,
        )}`,
    );
}

function getTextToAdd(lineBreak: string, blockName: RequestFileBlockName) {
    const whitespacesForIndentation = getNumberOfWhitespacesForIndentation();

    return `${blockName} {`
        .concat(`${lineBreak}${" ".repeat(whitespacesForIndentation)}url:`)
        .concat(
            `${lineBreak}${" ".repeat(whitespacesForIndentation)}body: ${
                MethodBlockBody.None
            }`,
        )
        .concat(
            `${lineBreak}${" ".repeat(whitespacesForIndentation)}auth: ${
                MethodBlockAuth.None
            }`,
        )
        .concat(`${lineBreak}}`);
}
