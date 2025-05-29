import {
    Position,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../shared";
import { getTempJsFileBlockContent } from "./getTempJsFileBlockContent";

export function getPositionWithinTempJsFile(
    tempJsFileContent: string,
    blockNameInBruFile: RequestFileBlockName,
    positionWithinBlock: Position
) {
    const block = getTempJsFileBlockContent(
        tempJsFileContent,
        blockNameInBruFile
    );

    if (!block) {
        return undefined;
    }

    const blockDocumentHelper = new TextDocumentHelper(block.content);

    if (
        !block ||
        positionWithinBlock.line >= blockDocumentHelper.getLineCount() ||
        positionWithinBlock.character >=
            blockDocumentHelper.getLineByIndex(positionWithinBlock.line).length
    ) {
        return undefined;
    }

    return new Position(
        block.range.start.line + positionWithinBlock.line,
        positionWithinBlock.character
    );
}
