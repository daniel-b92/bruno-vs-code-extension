import { DiagnosticSeverity, Uri } from "vscode";
import {
    castBlockToDictionaryBlock,
    DictionaryBlock,
    DictionaryBlockSimpleField,
    getPathParamsFromPathParamsBlock,
    getPathParamsFromUrl,
    getUrlFieldFromMethodBlock,
    Block,
    RequestFileBlockName,
    mapToVsCodeRange,
} from "../../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkUrlFromMethodBlockMatchesPathParamsBlock(
    documentUri: Uri,
    blocks: Block[]
): DiagnosticWithCode | undefined {
    const pathParamsBlocks = blocks.filter(
        ({ name }) => name == RequestFileBlockName.PathParams
    );

    const urlField = getUrlFieldFromMethodBlock(blocks);

    if (pathParamsBlocks.length > 1 || !urlField) {
        return undefined;
    } else if (pathParamsBlocks.length == 0 && urlField) {
        const expectedPathParams = getPathParamsFromUrl(urlField.value);

        return expectedPathParams.length > 0
            ? getDiagnosticForMissingPathParamsBlock(
                  urlField,
                  expectedPathParams
              )
            : undefined;
    }

    const pathParamsBlock = castBlockToDictionaryBlock(pathParamsBlocks[0]);

    if (!pathParamsBlock) {
        return undefined;
    }

    const expectedPathsBasedOnPathParamsBlock =
        getPathParamsFromPathParamsBlock(pathParamsBlock);
    const pathParamsFromUrl = getPathParamsFromUrl(urlField.value);

    const missingUrlSubstrings = expectedPathsBasedOnPathParamsBlock.filter(
        (expectedSubstring) => !pathParamsFromUrl.includes(expectedSubstring)
    );
    const missingPathParamsStrings = pathParamsFromUrl.filter(
        (expectedSubstring) =>
            !expectedPathsBasedOnPathParamsBlock.includes(expectedSubstring)
    );

    if (
        missingUrlSubstrings.length > 0 &&
        missingPathParamsStrings.length == 0
    ) {
        return getDiagnosticForMissingPathParamsInUrl(
            documentUri,
            urlField,
            missingUrlSubstrings,
            pathParamsBlock
        );
    } else if (
        missingUrlSubstrings.length == 0 &&
        missingPathParamsStrings.length > 0
    ) {
        return getDiagnosticForMissingValuesInPathParamsBlock(
            documentUri,
            urlField,
            missingPathParamsStrings,
            pathParamsBlock
        );
    } else if (
        missingUrlSubstrings.length > 0 &&
        missingPathParamsStrings.length > 0
    ) {
        return getDiagnosticForUrlNotMatchingPathParamsBlockValues(
            documentUri,
            urlField,
            missingPathParamsStrings,
            missingUrlSubstrings,
            pathParamsBlock
        );
    } else {
        return undefined;
    }
}

function getDiagnosticForMissingPathParamsInUrl(
    documentUri: Uri,
    urlFieldInMethodBlock: DictionaryBlockSimpleField,
    missingUrlSubstrings: string[],
    pathParamsBlock: DictionaryBlock
): DiagnosticWithCode {
    return {
        message: `URL is missing path params from '${
            RequestFileBlockName.PathParams
        }' block. Expected the URL to contain the following substrings: ${
            missingUrlSubstrings.length == 1
                ? `'${missingUrlSubstrings[0]}'`
                : JSON.stringify(missingUrlSubstrings, undefined, 2)
        }. Saving may fix this issue since the path params will be automatically updated, to match the url on saving.`,
        range: mapToVsCodeRange(urlFieldInMethodBlock.valueRange),
        severity: DiagnosticSeverity.Warning,
        relatedInformation: [
            {
                message: `'${RequestFileBlockName.PathParams}' block`,
                location: {
                    uri: documentUri,
                    range: mapToVsCodeRange(pathParamsBlock.contentRange),
                },
            },
        ],
        code: NonBlockSpecificDiagnosticCode.UrlFromMethodBlockMissingPathParams,
    };
}

function getDiagnosticForMissingValuesInPathParamsBlock(
    documentUri: Uri,
    urlFieldInMethodBlock: DictionaryBlockSimpleField,
    missingPathParams: string[],
    pathParamsBlock: DictionaryBlock
): DiagnosticWithCode {
    return {
        message: `'${
            RequestFileBlockName.PathParams
        }' block is missing entries for the following path params from the URL: ${
            missingPathParams.length == 1
                ? `'${missingPathParams[0]}'`
                : JSON.stringify(missingPathParams, undefined, 2)
        }`,
        range: mapToVsCodeRange(pathParamsBlock.contentRange),
        severity: DiagnosticSeverity.Error,
        relatedInformation: [
            {
                message: `URL field from method block`,
                location: {
                    uri: documentUri,
                    range: mapToVsCodeRange(urlFieldInMethodBlock.valueRange),
                },
            },
        ],
        code: NonBlockSpecificDiagnosticCode.PathParamsBlockMissingValuesFromUrl,
    };
}

function getDiagnosticForUrlNotMatchingPathParamsBlockValues(
    documentUri: Uri,
    urlFieldInMethodBlock: DictionaryBlockSimpleField,
    missingPathParamsInPathParamsBlock: string[],
    missingUrlSubstrings: string[],
    pathParamsBlock: DictionaryBlock
): DiagnosticWithCode {
    return {
        message: `Entries from '${
            RequestFileBlockName.PathParams
        }' missing in the URL: ${
            missingUrlSubstrings.length == 1
                ? `'${missingUrlSubstrings[0]}'`
                : JSON.stringify(missingUrlSubstrings, undefined, 2)
        }, Entries from the URL without a match in the '${
            RequestFileBlockName.PathParams
        }' block:${
            missingPathParamsInPathParamsBlock.length == 1
                ? `'${missingPathParamsInPathParamsBlock[0]}'`
                : JSON.stringify(
                      missingPathParamsInPathParamsBlock,
                      undefined,
                      2
                  )
        }`,
        range: mapToVsCodeRange(urlFieldInMethodBlock.valueRange),
        severity: DiagnosticSeverity.Error,
        relatedInformation: [
            {
                message: `'${RequestFileBlockName.PathParams}' block`,
                location: {
                    uri: documentUri,
                    range: mapToVsCodeRange(pathParamsBlock.contentRange),
                },
            },
        ],
        code: NonBlockSpecificDiagnosticCode.UrlFromMethodBlockNotMatchingPathParamsBlock,
    };
}

function getDiagnosticForMissingPathParamsBlock(
    urlFieldInMethodBlock: DictionaryBlockSimpleField,
    expectedPathParams: string[]
): DiagnosticWithCode {
    return {
        message: `Missing a '${
            RequestFileBlockName.PathParams
        }' block with the following keys: ${JSON.stringify(
            expectedPathParams.map((value) => value.substring(2)),
            null,
            2
        )}.`,
        range: mapToVsCodeRange(urlFieldInMethodBlock.valueRange),
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.PathParamsBlockMissing,
    };
}
