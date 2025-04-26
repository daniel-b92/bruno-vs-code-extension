import { DiagnosticSeverity, Uri } from "vscode";
import {
    castBlockToDictionaryBlock,
    DictionaryBlock,
    DictionaryBlockField,
    getExpectedUrlQueryParamsForQueryParamsBlock,
    RequestFileBlock,
    RequestFileBlockName,
} from "../../../../../shared";
import { DiagnosticWithCode } from "../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { getUrlFieldFromMethodBlock } from "../../util/getUrlFieldFromMethodBlock";

export function checkUrlFromMethodBlockMatchesQueryParamsBlock(
    documentUri: Uri,
    blocks: RequestFileBlock[]
): DiagnosticWithCode | undefined {
    const queryParamsBlocks = blocks.filter(
        ({ name }) => name == RequestFileBlockName.QueryParams
    );

    const urlField = getUrlFieldFromMethodBlock(blocks);

    if (queryParamsBlocks.length > 1 || !urlField) {
        return undefined;
    } else if (queryParamsBlocks.length == 0 && urlField) {
        const parsedUrl = new URL(urlField.value);
        const expectedQueryParams = parsedUrl.searchParams;

        return expectedQueryParams.size > 0
            ? getDiagnosticForMissingQueryParamsBlock(
                  urlField,
                  expectedQueryParams
              )
            : undefined;
    }

    const queryParamsBlock = castBlockToDictionaryBlock(queryParamsBlocks[0]);

    if (!queryParamsBlock) {
        return undefined;
    }

    const queryParamsFromQueryParamsBlock =
        getExpectedUrlQueryParamsForQueryParamsBlock(queryParamsBlock);
    const queryParamsFromUrl = new URL(urlField.value).searchParams;

    if (queryParamsFromUrl != queryParamsFromQueryParamsBlock) {
        return getDiagnosticForUrlNotMatchingQueryParamsBlock(
            documentUri,
            urlField,
            queryParamsBlock,
            queryParamsFromQueryParamsBlock,
            queryParamsFromUrl
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
    queryParamsFromUrl: URLSearchParams
): DiagnosticWithCode {
    return {
        message: `Query params from URL '${queryParamsFromUrl}' do not match query params from '${RequestFileBlockName.QueryParams}' block '${queryParamsFromQueryParamsBlock}'.`,
        range: urlFieldInMethodBlock.valueRange,
        severity: DiagnosticSeverity.Error,
        relatedInformation: [
            {
                message: `'${RequestFileBlockName.QueryParams}' block`,
                location: {
                    uri: documentUri,
                    range: queryParamsBlock.contentRange,
                },
            },
        ],
        code: NonBlockSpecificDiagnosticCode.UrlFromMethodBlockNotMatchingQueryParamsBlock,
    };
}

function getDiagnosticForMissingQueryParamsBlock(
    urlFieldInMethodBlock: DictionaryBlockField,
    expectedQueryParams: URLSearchParams
): DiagnosticWithCode {
    return {
        message: `Missing a '${
            RequestFileBlockName.QueryParams
        }' block with the following entries: ${JSON.stringify(
            Array.from(expectedQueryParams.entries()).map(
                (values) => `${values[0]}: ${values[1]}`
            ),
            null,
            2
        )}.`,
        range: urlFieldInMethodBlock.valueRange,
        severity: DiagnosticSeverity.Warning,
        code: NonBlockSpecificDiagnosticCode.QueryParamsBlockMissing,
    };
}
