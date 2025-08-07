import {
    Range,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../shared";
import { mapBlockNameToJsFileLine } from "./mapBlockNameToJsFileFunctionName";

export function getTempJsFileBlockContent(
    fullFileContent: string,
    blockName: RequestFileBlockName
): { content: string; range: Range } | undefined {
    const expectedFunctionDeclarationLine = mapBlockNameToJsFileLine(blockName);

    const documentHelper = new TextDocumentHelper(fullFileContent);
    const functionDeclarationLine = documentHelper
        .getAllLines()
        .find(({ content }) => content == expectedFunctionDeclarationLine);

    if (functionDeclarationLine == undefined) {
        return undefined;
    }

    return documentHelper.getContentUntilClosingChar(
        functionDeclarationLine.index + 1,
        "{",
        "}"
    );
}
