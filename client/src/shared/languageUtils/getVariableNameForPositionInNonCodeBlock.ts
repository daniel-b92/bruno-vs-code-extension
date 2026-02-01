import { TextDocument, Position as VsCodePosition } from "vscode";
import { getPatternForVariablesInNonCodeBlock } from "@global_shared";
import {
    getMatchingTextContainingPosition,
    mapFromVsCodePosition,
} from "@shared";

export function getVariableNameForPositionInNonCodeBlock(params: {
    document: TextDocument;
    position: VsCodePosition;
}) {
    const { document, position } = params;

    const matchingTextResult = getMatchingTextContainingPosition(
        document,
        mapFromVsCodePosition(position),
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
