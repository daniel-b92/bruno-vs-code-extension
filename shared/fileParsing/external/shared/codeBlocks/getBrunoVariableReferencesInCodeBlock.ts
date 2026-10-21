import {
    BrunoVariableReference,
    getInbuiltFunctionAndFirstParameterIfStringLiteral,
    getInbuiltFunctionAvailabilityScope,
    getInbuiltFunctionIdentifiers,
    getInbuiltFunctionReferenceType,
    getInbuiltFunctionVariableType,
    Position,
    Range,
    TextDocumentHelper,
} from "../../../..";

export function getBrunoVariableReferencesInCodeBlock(
    fullDocumentHelper: TextDocumentHelper,
    contentRange: Range,
): BrunoVariableReference[] {
    // The content may start within a line (e.g. a script defined as a single-line scalar). Padding it keeps all offsets relative to the start of the line.
    const contentStartPosition = new Position(contentRange.start.line, 0);
    const relevantContent = " "
        .repeat(contentRange.start.character)
        .concat(fullDocumentHelper.getText(contentRange));
    const functionsToSearchFor = getInbuiltFunctionIdentifiers();

    const matchingContentWithinSubdocument = Array.from(
        relevantContent.matchAll(
            new RegExp(
                `(${functionsToSearchFor.map(({ functionName }) => functionName).join("|")})`,
                "g",
            ),
        ),
    );

    const results = matchingContentWithinSubdocument.map(
        ({ index: offsetWithinSubdocument }) => {
            const position = fullDocumentHelper.getPositionForOffset(
                contentStartPosition,
                offsetWithinSubdocument,
            );
            if (!position) {
                return undefined;
            }

            return getInbuiltFunctionAndFirstParameterIfStringLiteral({
                functionsToSearchFor,
                position,
                relevantContent: {
                    asString: relevantContent,
                    startPosition: contentStartPosition,
                    offsetInFullDocument: fullDocumentHelper.getText(
                        new Range(new Position(0, 0), contentStartPosition),
                    ).length,
                },
            });
        },
    );

    return results
        .filter((v) => v != undefined)
        .map(
            ({
                inbuiltFunction: { identifier },
                firstParameter: {
                    name: variableName,
                    start: variableStart,
                    end: variableEnd,
                },
            }) => ({
                variableName,
                variableNameRange: new Range(variableStart, variableEnd),
                referenceType: getInbuiltFunctionReferenceType(identifier),
                variableType: getInbuiltFunctionVariableType(identifier),
                scope: getInbuiltFunctionAvailabilityScope(identifier),
            }),
        );
}
