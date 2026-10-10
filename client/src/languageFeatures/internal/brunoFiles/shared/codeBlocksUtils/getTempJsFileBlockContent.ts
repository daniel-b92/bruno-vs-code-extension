import { parseCodeBlock, Range, TextDocumentHelper } from "@global_shared";
import { isJsFileLineForBlock } from "./mapBlockNameToJsFileLine";

export function getTempJsFileBlockContent(
    fullTempJsFileContent: string,
    blockName: string,
): { content: string; range: Range } | undefined {
    const documentHelper = new TextDocumentHelper(fullTempJsFileContent);
    const blockStartLine = documentHelper
        .getAllLines()
        .find(({ content }) => isJsFileLineForBlock(content, blockName));

    if (blockStartLine == undefined) {
        return undefined;
    }

    const parsedBlock = parseCodeBlock(
        documentHelper,
        blockStartLine.index + 1,
    );

    return parsedBlock
        ? {
              content: parsedBlock.content,
              range: parsedBlock.contentRange,
          }
        : undefined;
}
