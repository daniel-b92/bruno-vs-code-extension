import { DiagnosticSeverity } from "vscode";
import {
    Block,
    mapRange,
    RequestFileBlockName,
    Range,
    TextDocumentHelper,
    mapPosition,
    Position,
} from "../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { RelevantWithinBodyBlockDiagnosticCode } from "../../../shared/diagnosticCodes/relevantWithinBodyBlockDiagnosticCodeEnum";

export function checkJsonRequestBodySyntax(
    requestBody: Block
): DiagnosticWithCode | undefined {
    if (
        requestBody.name == RequestFileBlockName.JsonBody &&
        typeof requestBody.content == "string"
    ) {
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
                        placeholderForVariables
                    )
            );
        } catch (err) {
            return getDiagnostic(
                documentForBlock,
                requestBody,
                err,
                regexForFindingVariableOccurences,
                placeholderForVariables
            );
        }
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentForBlock: TextDocumentHelper,
    actualRequestBody: Block,
    errorInBlockWithReplacements: unknown,
    regexForFindingVariableOccurences: RegExp,
    placeholderForVariables: string
) {
    if (!(errorInBlockWithReplacements instanceof SyntaxError)) {
        return getDiagnosticForUnexpectedErrorWhileParsingJson(
            actualRequestBody.contentRange,
            errorInBlockWithReplacements
        );
    }

    const startPositionWithinBlock = getPositionForSyntaxErrorWithinBlock(
        documentForBlock,
        errorInBlockWithReplacements,
        regexForFindingVariableOccurences,
        placeholderForVariables
    );

    if (startPositionWithinBlock) {
        const searchString = "at position ";
        const positionInFullDocument = mapPosition(
            startPositionWithinBlock
        ).translate(actualRequestBody.contentRange.start.line);

        return {
            message: errorInBlockWithReplacements.message.includes(searchString)
                ? errorInBlockWithReplacements.message.substring(
                      0,
                      errorInBlockWithReplacements.message.lastIndexOf(
                          searchString
                      )
                  )
                : errorInBlockWithReplacements.message,
            range: mapRange(
                new Range(positionInFullDocument, positionInFullDocument)
            ),
            severity: DiagnosticSeverity.Error,
            code: RelevantWithinBodyBlockDiagnosticCode.JsonSyntaxNotValid,
        };
    } else {
        return getDiagnosticForSyntaxErrorWithoutPosition(
            actualRequestBody.contentRange,
            errorInBlockWithReplacements
        );
    }
}

function getPositionForSyntaxErrorWithinBlock(
    docForActualBlock: TextDocumentHelper,
    errorInBlockWithReplacements: SyntaxError,
    regexForFindingVariableOccurences: RegExp,
    placeholderForVariables: string
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
            placeholderForVariables
        )
    );
}

function mapOffsetFromSyntaxErrorToOffsetInActualBlock(
    docForActualBlock: TextDocumentHelper,
    regexForFindingVariableOccurences: RegExp,
    errorOffsetInBlockWithReplacements: number,
    placeholderForVariables: string
) {
    const replacedSubstringsInOriginalDoc =
        getSubstringsThatHaveBeenReplacedInActualDoc(
            docForActualBlock,
            regexForFindingVariableOccurences
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
    regexForFindingVariableOccurences: RegExp
): { content: string; offset: number }[] {
    const matches = Array.from(
        docForActualBlock.getText().matchAll(regexForFindingVariableOccurences)
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
    error: unknown
) {
    return {
        message: `An unexpected error ocured while trying to parse the JSON request body. ${
            error instanceof Error
                ? `Got error message '${error.message}'.`
                : "Failed to parse message from error."
        }`,
        range: mapRange(blockContentRange),
        severity: DiagnosticSeverity.Error,
        code: RelevantWithinBodyBlockDiagnosticCode.UnexpectedErrorWhileParsingJson,
    };
}

function getDiagnosticForSyntaxErrorWithoutPosition(
    blockContentRange: Range,
    error: SyntaxError
) {
    return {
        message: error.message,
        range: mapRange(blockContentRange),
        severity: DiagnosticSeverity.Error,
        code: RelevantWithinBodyBlockDiagnosticCode.JsonSyntaxNotValid,
    };
}
