import { DiagnosticSeverity, Uri } from "vscode";
import {
    DictionaryBlock,
    DictionaryBlockField,
    getExpectedUrlQueryParamsForQueryParamsBlock,
    getQueryParamsFromUrl,
    getUrlFieldFromMethodBlock,
    getUrlSubstringForQueryParams,
    getValidDictionaryBlocksWithName,
    Block,
    RequestFileBlockName,
    mapRange,
} from "../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkUrlFromMethodBlockMatchesQueryParamsBlock(
    documentUri: Uri,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    const queryParamsBlocks = getValidDictionaryBlocksWithName(
        blocks,
        RequestFileBlockName.QueryParams,
    );

    const urlField = getUrlFieldFromMethodBlock(blocks);

    if (queryParamsBlocks.length > 1 || !urlField) {
        return undefined;
    } else if (queryParamsBlocks.length == 0 && urlField) {
        const expectedQueryParams = getQueryParamsFromUrl(urlField.value);

        return expectedQueryParams && expectedQueryParams.size > 0
            ? getDiagnosticForMissingQueryParamsBlock(
                  urlField,
                  expectedQueryParams,
              )
            : undefined;
    }

    const queryParamsBlock = queryParamsBlocks[0];

    const queryParamsFromQueryParamsBlock =
        getExpectedUrlQueryParamsForQueryParamsBlock(queryParamsBlock);

    const queryParamsFromUrl = getQueryParamsFromUrl(urlField.value);

    if (
        (!queryParamsFromUrl && queryParamsFromQueryParamsBlock.size > 0) ||
        (queryParamsFromUrl &&
            queryParamsFromUrl.toString() !=
                queryParamsFromQueryParamsBlock.toString())
    ) {
        return getDiagnosticForUrlNotMatchingQueryParamsBlock(
            documentUri,
            urlField,
            queryParamsBlock,
            queryParamsFromQueryParamsBlock,
            queryParamsFromUrl,
        );
    } else {
        return undefined;
    }
}

function getDiagnosticForUrlNotMatchingQueryParamsBlock(
    documentUri: Uri,
    urlFieldInMethodBlock: DictionaryBlockField,
    queryParamsBlock: DictionaryBlock,
    queryParamsFromQueryParamsBlock: URLSearchParams,
    queryParamsFromUrl: URLSearchParams | undefined,
): DiagnosticWithCode {
    return {
        message: `Query params from URL '${getUrlSubstringForQueryParams(
            queryParamsFromUrl ?? new URLSearchParams(""),
        )}' do not match query params from '${
            RequestFileBlockName.QueryParams
        }' block '${getUrlSubstringForQueryParams(
            queryParamsFromQueryParamsBlock,
        )}'. Saving may fix this issue since the url will be automatically updated, to match the query params on saving.`,
        range: mapRange(urlFieldInMethodBlock.valueRange),
        severity: DiagnosticSeverity.Error,
        relatedInformation: [
            {
                message: `'${RequestFileBlockName.QueryParams}' block`,
                location: {
                    uri: documentUri,
                    range: mapRange(queryParamsBlock.contentRange),
                },
            },
        ],
        code: NonBlockSpecificDiagnosticCode.UrlFromMethodBlockNotMatchingQueryParamsBlock,
    };
}

function getDiagnosticForMissingQueryParamsBlock(
    urlFieldInMethodBlock: DictionaryBlockField,
    expectedQueryParams: URLSearchParams,
): DiagnosticWithCode {
    return {
        message: `Missing a '${
            RequestFileBlockName.QueryParams
        }' block with the following entries: ${JSON.stringify(
            Array.from(expectedQueryParams.entries()).map(
                (values) => `${values[0]}: ${values[1]}`,
            ),
            null,
            2,
        )}.`,
        range: mapRange(urlFieldInMethodBlock.valueRange),
        severity: DiagnosticSeverity.Warning,
        code: NonBlockSpecificDiagnosticCode.QueryParamsBlockMissing,
    };
}
