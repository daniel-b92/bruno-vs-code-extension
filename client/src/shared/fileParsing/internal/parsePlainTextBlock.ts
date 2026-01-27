import { BlockType, Position, Range, TextDocumentHelper } from "../..";
import { findBlockEnd } from "./findBlockEnd";

export function parsePlainTextBlock(
    documentHelper: TextDocumentHelper,
    firstContentLine: number,
    blockType: BlockType,
) {
    const blockEndPosition = findBlockEnd(
        documentHelper,
        firstContentLine,
        blockType,
    );

    if (!blockEndPosition) {
        return undefined;
    }

    const contentRange = new Range(
        new Position(firstContentLine, 0),
        blockEndPosition,
    );

    return {
        content: documentHelper.getText(contentRange),
        contentRange,
    };
}
