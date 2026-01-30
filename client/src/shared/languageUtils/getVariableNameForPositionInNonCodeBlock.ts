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

    const matchingText = getMatchingTextContainingPosition(
        document,
        mapFromVsCodePosition(position),
        new RegExp(getPatternForVariablesInNonCodeBlock()),
    );

    return matchingText
        ? matchingText.substring(
              matchingText.indexOf("{{") + 2,
              matchingText.indexOf("}}"),
          )
        : undefined;
}
