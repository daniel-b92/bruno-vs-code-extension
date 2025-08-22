import { Position, TextDocumentHelper } from "../../../../shared";
import { mapSourceFileToTempJsFileContent } from "./mapSourceFileToTempJsFileContent";

export function getCorrespondingPositionInTempJsFile(
    positionInSourceFile: Position,
) {
    const additionalContentDoc = new TextDocumentHelper(
        mapSourceFileToTempJsFileContent(""),
    );

    return new Position(
        positionInSourceFile.line + additionalContentDoc.getLineCount(),
        positionInSourceFile.character,
    );
}
