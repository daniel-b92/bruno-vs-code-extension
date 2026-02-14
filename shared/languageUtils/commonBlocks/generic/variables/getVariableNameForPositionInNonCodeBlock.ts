import {
    getMatchingTextContainingPosition,
    getPatternForVariablesInNonCodeBlock,
    Position,
    TextDocumentHelper,
} from "../../../..";

export function getVariableNameForPositionInNonCodeBlock(params: {
    documentHelper: TextDocumentHelper;
    position: Position;
}) {
    const { documentHelper, position } = params;

    const matchingTextResult = getMatchingTextContainingPosition(
        position,
        documentHelper.getLineByIndex(position.line),
        new RegExp(getPatternForVariablesInNonCodeBlock()),
    );

    if (!matchingTextResult) {
        return undefined;
    }

    const { text: matchingText } = matchingTextResult;

    return matchingText.substring(
        matchingText.indexOf("{{") + 2,
        matchingText.indexOf("}}"),
    );
}
