import { Position, TextDocumentHelper } from "../../../../shared";
import { mapSourceFileToTempJsFileContent } from "./mapSourceFileToTempJsFileContent";

export function getCorrespondingPositionInSourceFile(
    positionInTempJsFile: Position,
) {
    const additionalContentDoc = new TextDocumentHelper(
        mapSourceFileToTempJsFileContent(""),
    );

    const additionalContentLines = additionalContentDoc.getLineCount();

    // added content ends with a linebreak
    if (positionInTempJsFile.line < additionalContentLines - 1) {
        throw new Error(`Could not map position in temp js file to corresponding position in source js file. 
Got line ${positionInTempJsFile.line} from requested position and determined lines of additional content to be ${additionalContentLines}`);
    }

    return new Position(
        positionInTempJsFile.line - additionalContentDoc.getLineCount() + 1,
        positionInTempJsFile.character,
    );
}
