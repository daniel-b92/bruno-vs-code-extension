import { Position, TextDocumentHelper } from "../../../../shared";
import { mapSourceFileToTempJsFileContent } from "./mapSourceFileToTempJsFileContent";

export function getCorrespondingPositionInTempJsFile(
    positionInSourceFile: Position,
) {
    const additionalContentDoc = new TextDocumentHelper(
        mapSourceFileToTempJsFileContent(""),
    );

    if (additionalContentDoc.getLineCount() < 1) {
        throw new Error(
            `Could not map position in source js file to postion in temp js file because the additional content document has less than 1 line.`,
        );
    }

    return new Position(
        positionInSourceFile.line + additionalContentDoc.getLineCount() - 1, // added content ends with a linebreak
        positionInSourceFile.character,
    );
}
