import {
    getMatchingTextContainingPosition,
    mapFromVsCodePosition,
} from "../../../../../shared";
import { LanguageFeatureRequest } from "../../../shared/interfaces";

export function getVariableNameForPositionInNonCodeBlock({
    document,
    position,
}: LanguageFeatureRequest) {
    const pattern = /{{\S+?}}/;

    const matchingText = getMatchingTextContainingPosition(
        document,
        mapFromVsCodePosition(position),
        pattern,
    );

    return matchingText
        ? matchingText.substring(
              matchingText.indexOf("{{") + 2,
              matchingText.indexOf("}}"),
          )
        : undefined;
}
