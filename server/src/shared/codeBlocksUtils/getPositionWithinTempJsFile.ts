import {
    Position,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../../client/src/shared";
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

    if (positionWithinBlock.line >= blockDocumentHelper.getLineCount()) {
        return undefined;
    }

    return new Position(
        block.range.start.line + positionWithinBlock.line,
        positionWithinBlock.character
    );
}
