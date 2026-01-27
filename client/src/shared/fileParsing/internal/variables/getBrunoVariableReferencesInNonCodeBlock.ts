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
    const matches = Array.from(
        fullDocumentHelper
            .getText(contentRange)
            .matchAll(new RegExp(getPatternForVariablesInNonCodeBlock(), "g")),
    );

    if (matches.length == 0) {
        return [];
    }

    return matches
        .map((match) => {
            const matchingText = match[0];
            const variableStartOffsetWithinMatch = 2;
            const variableName = matchingText.substring(
                matchingText.indexOf("{{") + variableStartOffsetWithinMatch,
                matchingText.indexOf("}}"),
            );
            const variableStartPositionInFullDocument =
                fullDocumentHelper.getPositionForOffset(
                    contentRange.start,
                    match.index + variableStartOffsetWithinMatch,
                );

            return variableStartPositionInFullDocument
                ? {
                      variableName,
                      variableNameRange: new Range(
                          variableStartPositionInFullDocument,
                          new Position(
                              variableStartPositionInFullDocument.line,
                              variableStartPositionInFullDocument.character +
                                  variableName.length,
                          ),
                      ),
                      referenceType: VariableReferenceType.Read, // In non-code blocks, variables can not be set.
                      variableType: BrunoVariableType.Unknown, // In non-code blocks, variables can only be accessed by name, not by any specific type.
                  }
                : undefined;
        })
        .filter((v) => v != undefined);
}
