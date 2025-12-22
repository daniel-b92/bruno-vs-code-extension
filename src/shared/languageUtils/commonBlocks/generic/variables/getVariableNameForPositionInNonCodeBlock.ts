import { TextDocument, Position as VsCodePosition } from "vscode";
import {
    getMatchingTextContainingPosition,
    getPatternForVariablesInNonCodeBlock,
    mapFromVsCodePosition,
} from "../../../..";

export function getVariableNameForPositionInNonCodeBlock(params: {
    document: TextDocument;
    position: VsCodePosition;
}) {
    const { document, position } = params;

    const matchingText = getMatchingTextContainingPosition(
        document,
        mapFromVsCodePosition(position),
        getPatternForVariablesInNonCodeBlock(),
    );

    return matchingText
        ? matchingText.substring(
              matchingText.indexOf("{{") + 2,
              matchingText.indexOf("}}"),
          )
        : undefined;
}
