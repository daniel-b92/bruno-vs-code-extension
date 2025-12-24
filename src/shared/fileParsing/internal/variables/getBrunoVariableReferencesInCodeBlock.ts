import {
    BrunoVariableReference,
    BrunoVariableType,
    getInbuiltFunctionAndFirstParameterIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    getInbuiltFunctions,
    Position,
    Range,
    TextDocumentHelper,
} from "../../..";

export function getBrunoVariableReferencesInCodeBlock(
    fullDocumentHelper: TextDocumentHelper,
    contentRange: Range,
): BrunoVariableReference[] {
    const { start: contentStartPosition } = contentRange;
    const relevantContent = fullDocumentHelper.getText(contentRange);
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
                inbuiltFunction: {
                    identifier: { functionName },
                },
                firstParameter: {
                    name: variableName,
                    start: variableStart,
                    end: variableEnd,
                },
            }) => ({
                variableName,
                variableNameRange: new Range(variableStart, variableEnd),
                referenceType: getInbuiltFunctions()[functionName].type,
                variableType: BrunoVariableType.Environment,
            }),
        );
}
