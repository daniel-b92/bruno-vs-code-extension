import {
    getMatchingTextContainingPosition,
    getPatternForVariablesInNonCodeBlock,
    Position,
    TextDocumentHelper,
} from "../../../..";

export function getVariableForPositionInNonCodeBlock(params: {
    documentHelper: TextDocumentHelper;
    position: Position;
}) {
    const { documentHelper, position } = params;
    const { line } = position;

    const matchingTextResult = getMatchingTextContainingPosition(
        position,
        documentHelper.getLineByIndex(line),
        new RegExp(getPatternForVariablesInNonCodeBlock()),
    );

    if (!matchingTextResult) {
        return undefined;
    }

    const { text: matchingText } = matchingTextResult;
    const variableStartChar = matchingText.indexOf("{{") + 2;
    const variableEndChar = matchingText.indexOf("}}");

    return {
        start: new Position(line, variableStartChar),
        end: new Position(line, variableEndChar),
        name: matchingText.substring(variableStartChar, variableEndChar),
    };
}
