import { Position, TextDocumentHelper } from "@global_shared";
import { getTempJsFileBlockContent } from "./getTempJsFileBlockContent";

export function getPositionWithinTempJsFile(
    tempJsFileContent: string,
    blockName: string,
    positionWithinBlock: Position,
) {
    const block = getTempJsFileBlockContent(tempJsFileContent, blockName);

    if (!block) {
        return undefined;
    }

    const blockDocumentHelper = new TextDocumentHelper(block.content);

    if (positionWithinBlock.line >= blockDocumentHelper.getLineCount()) {
        return undefined;
    }

    return new Position(
        block.range.start.line + positionWithinBlock.line,
        positionWithinBlock.character,
    );
}
