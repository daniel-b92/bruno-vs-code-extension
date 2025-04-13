import { Position } from "vscode";
import { TextDocumentHelper } from "../../util/textDocumentHelper";
import { RequestFileBlockName } from "../definitions/requestFileBlockNameEnum";
import { getBlockContent } from "./getBlockContent";

export const parseBlockFromTestFile = (
    document: TextDocumentHelper,
    blockName: RequestFileBlockName
) => {
    const blockStartPattern = new RegExp(`^\\s*${blockName}\\s*{\\s*$`, "m");

    const maybeMatches = document.getText().match(blockStartPattern);

    if (!maybeMatches || maybeMatches.length != 1) {
        return undefined;
    }

    const subDocumentUntilBlockStart = new TextDocumentHelper(
        document
            .getText()
            .substring(
                0,
                (maybeMatches.index as number) +
                    maybeMatches[0].indexOf("{") +
                    1
            )
    );
    const lineIndex = subDocumentUntilBlockStart.getLineCount() - 1;

    const startingBracket = new Position(
        lineIndex,
        subDocumentUntilBlockStart.getLineByIndex(lineIndex).lastIndexOf("{")
    );

    return getBlockContent(document, startingBracket).content;
};
