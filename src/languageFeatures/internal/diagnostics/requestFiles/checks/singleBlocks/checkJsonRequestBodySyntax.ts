import { DiagnosticSeverity } from "vscode";
import {
    Block,
    mapRange,
    RequestFileBlockName,
    Range,
    TextDocumentHelper,
    mapPosition,
    Position,
} from "../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { RelevantWithinBodyBlockDiagnosticCode } from "../../../shared/diagnosticCodes/relevantWithinBodyBlockDiagnosticCodeEnum";

export function checkJsonRequestBodySyntax(
    requestBody: Block
): DiagnosticWithCode | undefined {
    if (
        requestBody.name == RequestFileBlockName.JsonBody &&
        typeof requestBody.content == "string"
    ) {
        const regexForFindingVariableOccurences = /{{\S*?}}/g;
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
                regexForFindingVariableOccurences
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
    regexForFindingVariableOccurences: RegExp
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
        regexForFindingVariableOccurences
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
    regexForFindingVariableOccurences: RegExp
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
            errorOffsetInBlockWithReplacements
        )
    );
}

function mapOffsetFromSyntaxErrorToOffsetInActualBlock(
    docForActualBlock: TextDocumentHelper,
    regexForFindingVariableOccurences: RegExp,
    errorOffsetInBlockWithReplacements: number
) {
    const replacedSubstringsInOriginalDoc =
        getSubstringsThatHaveBeenReplacedInActualDoc(
            docForActualBlock,
            regexForFindingVariableOccurences
        );

    if (!replacedSubstringsInOriginalDoc) {
        return 0;
    }

    // ToDo: Also detemrine offset correctly if more than one substring has been replaced
    const { firstSubstring } = replacedSubstringsInOriginalDoc;

    return firstSubstring.offset <= errorOffsetInBlockWithReplacements
        ? firstSubstring.content.length
        : 0;
}

function getSubstringsThatHaveBeenReplacedInActualDoc(
    document: TextDocumentHelper,
    regexForFindingVariableOccurences: RegExp
):
    | {
          firstSubstring: { content: string; offset: number };
          followingSubstrings: { content: string }[];
      }
    | undefined {
    const matches = regexForFindingVariableOccurences.exec(document.getText());

    if (!matches || matches.length == 0) {
        return undefined;
    }

    const firstSubstring = { content: matches[0], offset: matches.index };

    return matches.length == 1
        ? { firstSubstring, followingSubstrings: [] }
        : {
              firstSubstring,
              followingSubstrings: matches
                  .slice(1)
                  .map((string) => ({ content: string })),
          };
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
