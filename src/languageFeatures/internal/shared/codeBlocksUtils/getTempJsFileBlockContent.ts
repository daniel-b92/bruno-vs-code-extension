import { Node, SourceFile, SyntaxKind } from "typescript";
import {
    parseCodeBlock,
    Range,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../../shared";
import { mapBlockNameToJsFileLine } from "./mapBlockNameToJsFileFunctionName";

export function getTempJsFileBlockContent(
    fullTempJsFileContent: string,
    blockName: RequestFileBlockName,
): { content: string; range: Range } | undefined {
    const expectedFunctionDeclarationLine = mapBlockNameToJsFileLine(blockName);

    const documentHelper = new TextDocumentHelper(fullTempJsFileContent);
    const functionDeclarationLine = documentHelper
        .getAllLines()
        .find(({ content }) => content == expectedFunctionDeclarationLine);

    if (functionDeclarationLine == undefined) {
        return undefined;
    }

    const parsedBlock = parseCodeBlockFromTempJsFile(
        documentHelper,
        functionDeclarationLine.index + 1,
    );

    return parsedBlock
        ? { content: parsedBlock.content, range: parsedBlock.contentRange }
        : undefined;
}

function parseCodeBlockFromTempJsFile(
    document: TextDocumentHelper,
    firstContentLine: number,
) {
    return parseCodeBlock(
        document,
        firstContentLine,
        (sourceFile: SourceFile) =>
            (sourceFile as Node)
                .getChildAt(0, sourceFile)
                .getChildren(sourceFile)
                .find(({ kind }) => kind == SyntaxKind.FunctionDeclaration),
    );
}
