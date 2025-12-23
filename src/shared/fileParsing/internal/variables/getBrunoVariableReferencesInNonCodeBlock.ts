import {
    BrunoVariableReference,
    BrunoVariableType,
    getPatternForVariablesInNonCodeBlock,
    Position,
    Range,
    TextDocumentHelper,
    VariableReferenceType,
} from "../../..";

export function getBrunoVariableReferencesInNonCodeBlock(
    fullDocumentHelper: TextDocumentHelper,
    contentRange: Range,
): BrunoVariableReference[] {
    const result: BrunoVariableReference[] = [];
    let remainingContent = fullDocumentHelper.getText(contentRange);

    do {
        const matches =
            getPatternForVariablesInNonCodeBlock().exec(remainingContent);

        if (matches == null || matches.length == 0) {
            return result;
        }
        const matchingText = matches[0];
        const variableStartOffsetWithinMatch = 2;
        const variableName = matchingText.substring(
            matchingText.indexOf("{{") + variableStartOffsetWithinMatch,
            matchingText.indexOf("}}"),
        );
        const variableStartPositionInFullDocument =
            fullDocumentHelper.getPositionForOffset(
                contentRange.start,
                matches.index + variableStartOffsetWithinMatch,
            );

        if (!variableStartPositionInFullDocument) {
            return result;
        }

        result.push({
            variableName,
            variableNameRange: new Range(
                variableStartPositionInFullDocument,
                new Position(
                    variableStartPositionInFullDocument.line,
                    variableStartPositionInFullDocument.character +
                        variableName.length,
                ),
            ),
            referenceType: VariableReferenceType.Read,
            variableType: BrunoVariableType.Unknown,
        });

        remainingContent =
            remainingContent.length > matches.index + matchingText.length
                ? remainingContent.substring(
                      matches.index + matchingText.length,
                  )
                : "";
    } while (remainingContent.length > 0);

    return result;
}
