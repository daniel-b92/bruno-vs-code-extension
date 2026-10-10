import { SyntaxKind } from "typescript";
import { parseCodeBlock, Range, TextDocumentHelper } from "@global_shared";
import { isJsFileLineForBlock } from "./mapBlockNameToJsFileFunctionName";

export function getTempJsFileBlockContent(
    fullTempJsFileContent: string,
    blockName: string,
): { content: string; range: Range } | undefined {
    const documentHelper = new TextDocumentHelper(fullTempJsFileContent);
    const functionDeclarationLine = documentHelper
        .getAllLines()
        .find(({ content }) => isJsFileLineForBlock(content, blockName));

    if (functionDeclarationLine == undefined) {
        return undefined;
    }

    const parsedBlock = parseCodeBlockFromTempJsFile(
        documentHelper,
        functionDeclarationLine.index + 1,
    );

    return parsedBlock
        ? {
              content: parsedBlock.content,
              range: parsedBlock.contentRange,
          }
        : undefined;
}

function parseCodeBlockFromTempJsFile(
    document: TextDocumentHelper,
    firstContentLine: number,
) {
    return parseCodeBlock(
        document,
        firstContentLine,
        SyntaxKind.ExpressionStatement,
    );
}
