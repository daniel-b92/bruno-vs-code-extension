import { Range, TextDocumentHelper, Position } from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

export interface PreciseErrorPositionMapping {
    /** The line in the document that the first line of the content is located in. */
    firstContentLine: number;
    /** The number of characters that each content line is indented by in the document. */
    indentation: number;
}

const messagePrefix = "Invalid JSON request body: ";

export interface JsonSyntaxCheckResult {
    diagnostic: Diagnostic;
    isUnexpectedError: boolean;
}

/**
 * Checks that the given content is valid JSON (while ignoring variable placeholders like `{{varName}}`).
 *
 * @param requestBody The JSON content and the range that the content has in the document.
 * @param preciseErrorPositionMapping If defined, the diagnostic will point to the exact error position within the content.
 * This is only valid, if the content has the same line breaks in the document as in `requestBody.content`
 * and every line is only shifted by a constant indentation.
 * Otherwise, the whole `contentRange` will be used for the diagnostic.
 */
export function checkJsonSyntax(
    requestBody: { content: string; contentRange: Range },
    preciseErrorPositionMapping?: PreciseErrorPositionMapping,
): JsonSyntaxCheckResult | undefined {
    const regexForFindingVariableOccurences = /{{\S+?}}/g;
    const placeholderForVariables = "1";
    const documentForBlock = new TextDocumentHelper(requestBody.content);

    try {
        // ToDo: Improve the replacement of variables within the request body (these look like this: {{valName}})
        // Currently, you would e.g. get a syntax error, if the variable were used for replacing a property name at runtime.
        // But the the Bruno app also seems to use the same placeholder value, so it should not be too bad for now.
        JSON.parse(
            documentForBlock
                .getText()
                .replace(
                    regexForFindingVariableOccurences,
                    placeholderForVariables,
                ),
        );
    } catch (err) {
        return getDiagnostic(
            documentForBlock,
            requestBody,
            err,
            regexForFindingVariableOccurences,
            placeholderForVariables,
            preciseErrorPositionMapping,
        );
    }
}

function getDiagnostic(
    documentForBlock: TextDocumentHelper,
    actualRequestBody: { contentRange: Range },
    errorInBlockWithReplacements: unknown,
    regexForFindingVariableOccurences: RegExp,
    placeholderForVariables: string,
    preciseErrorPositionMapping: PreciseErrorPositionMapping | undefined,
): JsonSyntaxCheckResult {
    if (!(errorInBlockWithReplacements instanceof SyntaxError)) {
        return getDiagnosticForUnexpectedErrorWhileParsingJson(
            actualRequestBody.contentRange,
            errorInBlockWithReplacements,
        );
    }

    const startPositionWithinBlock = preciseErrorPositionMapping
        ? getPositionForSyntaxErrorWithinBlock(
              documentForBlock,
              errorInBlockWithReplacements,
              regexForFindingVariableOccurences,
              placeholderForVariables,
          )
        : undefined;

    if (startPositionWithinBlock && preciseErrorPositionMapping) {
        const positionInFullDocument = new Position(
            startPositionWithinBlock.line +
                preciseErrorPositionMapping.firstContentLine,
            startPositionWithinBlock.character +
                preciseErrorPositionMapping.indentation,
        );

        return {
            isUnexpectedError: false,
            diagnostic: {
                message: getMessageWithoutPosition(
                    errorInBlockWithReplacements,
                ),
                range: new Range(
                    positionInFullDocument,
                    positionInFullDocument,
                ),
                severity: DiagnosticSeverity.Error,
            },
        };
    } else {
        return getDiagnosticForSyntaxErrorWithoutPosition(
            actualRequestBody.contentRange,
            errorInBlockWithReplacements,
        );
    }
}

/**
 * The position information in the message of the syntax error (e.g. `at position 14 (line 2 column 13)`) is relative to the extracted content,
 * so it would be misleading when shown for the whole document.
 */
function getMessageWithoutPosition(error: SyntaxError) {
    const messageWithoutPosition = error.message.replace(
        /(\s+in JSON)?\s+at position \d+.*$/s,
        "",
    );
    return `${messagePrefix}${messageWithoutPosition}`;
}

function getPositionForSyntaxErrorWithinBlock(
    docForActualBlock: TextDocumentHelper,
    errorInBlockWithReplacements: SyntaxError,
    regexForFindingVariableOccurences: RegExp,
    placeholderForVariables: string,
) {
    const message = errorInBlockWithReplacements.message;

    const matches = /at position (\d*)\s*/.exec(message);

    if (!matches || matches.length < 2) {
        return undefined;
    }

    const errorOffsetInBlockWithReplacements =
        matches[1] && !isNaN(Number(matches[1]))
            ? Number(matches[1])
            : undefined;

    if (errorOffsetInBlockWithReplacements == undefined) {
        return undefined;
    }

    return docForActualBlock.getPositionForOffset(
        new Position(0, 0),
        mapOffsetFromSyntaxErrorToOffsetInActualBlock(
            docForActualBlock,
            regexForFindingVariableOccurences,
            errorOffsetInBlockWithReplacements,
            placeholderForVariables,
        ),
    );
}

function mapOffsetFromSyntaxErrorToOffsetInActualBlock(
    docForActualBlock: TextDocumentHelper,
    regexForFindingVariableOccurences: RegExp,
    errorOffsetInBlockWithReplacements: number,
    placeholderForVariables: string,
) {
    const replacedSubstringsInOriginalDoc =
        getSubstringsThatHaveBeenReplacedInActualDoc(
            docForActualBlock,
            regexForFindingVariableOccurences,
        );

    if (replacedSubstringsInOriginalDoc.length == 0) {
        return errorOffsetInBlockWithReplacements;
    }

    let offsetToAddForBlockWithReplacements = 0;

    for (const {
        content: originalContent,
        offset: offsetInOriginalBlock,
    } of replacedSubstringsInOriginalDoc) {
        if (
            errorOffsetInBlockWithReplacements >
            offsetInOriginalBlock + offsetToAddForBlockWithReplacements
        ) {
            offsetToAddForBlockWithReplacements +=
                placeholderForVariables.length - originalContent.length;
        } else {
            break;
        }
    }

    return (
        errorOffsetInBlockWithReplacements - offsetToAddForBlockWithReplacements
    );
}

function getSubstringsThatHaveBeenReplacedInActualDoc(
    docForActualBlock: TextDocumentHelper,
    regexForFindingVariableOccurences: RegExp,
): { content: string; offset: number }[] {
    const matches = Array.from(
        docForActualBlock.getText().matchAll(regexForFindingVariableOccurences),
    );

    if (matches.length == 0) {
        return [];
    }

    return matches.map(({ "0": content, index }) => ({
        content,
        offset: index,
    }));
}

function getDiagnosticForUnexpectedErrorWhileParsingJson(
    blockContentRange: Range,
    error: unknown,
): JsonSyntaxCheckResult {
    return {
        isUnexpectedError: true,
        diagnostic: {
            message: `An unexpected error occurred while trying to parse the JSON request body. ${
                error instanceof Error
                    ? `Got error message '${error.message}'.`
                    : "Failed to parse message from error."
            }`,
            range: blockContentRange,
            severity: DiagnosticSeverity.Error,
        },
    };
}

function getDiagnosticForSyntaxErrorWithoutPosition(
    blockContentRange: Range,
    error: SyntaxError,
): JsonSyntaxCheckResult {
    return {
        isUnexpectedError: false,
        diagnostic: {
            message: getMessageWithoutPosition(error),
            range: blockContentRange,
            severity: DiagnosticSeverity.Error,
        },
    };
}
