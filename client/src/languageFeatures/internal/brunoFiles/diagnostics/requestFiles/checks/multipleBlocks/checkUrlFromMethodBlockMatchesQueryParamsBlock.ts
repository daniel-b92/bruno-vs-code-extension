import { DiagnosticSeverity, Uri } from "vscode";
import {
    DictionaryBlockSimpleField,
    getExpectedUrlQueryParamsForQueryParamsBlock,
    getQueryParamsFromUrl,
    getUrlFieldFromMethodBlock,
    getUrlSubstringForQueryParams,
    getValidDictionaryBlocksWithName,
    Block,
    RequestFileBlockName,
    isDictionaryBlockSimpleField,
    Range,
} from "@global_shared";
import { mapToVsCodeRange } from "@shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { getSortedDictionaryBlockFieldsByPosition } from "../../../shared/util/getSortedDictionaryBlockFieldsByPosition";

export function checkUrlFromMethodBlockMatchesQueryParamsBlock(
    documentUri: Uri,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    const queryParamsBlocks = getValidDictionaryBlocksWithName(
        blocks,
        RequestFileBlockName.QueryParams,
    );

    const urlField = getUrlFieldFromMethodBlock(blocks);

    if (
        queryParamsBlocks.length > 1 ||
        !urlField ||
        !isDictionaryBlockSimpleField(urlField)
    ) {
        return undefined;
    } else if (
        queryParamsBlocks.length == 0 &&
        urlField &&
        isDictionaryBlockSimpleField(urlField)
    ) {
        const expectedQueryParams = getQueryParamsFromUrl(urlField.value);

        return expectedQueryParams && expectedQueryParams.size > 0
            ? getDiagnosticForMissingQueryParamsBlock(
                  urlField,
                  expectedQueryParams,
              )
            : undefined;
    } else if (
        !queryParamsBlocks[0].content.every((field) =>
            isDictionaryBlockSimpleField(field),
        )
    ) {
        return undefined;
    }

    const queryParamsBlockFields = queryParamsBlocks[0].content;

    const queryParamsFromQueryParamsBlock =
        getExpectedUrlQueryParamsForQueryParamsBlock(queryParamsBlockFields);

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
            queryParamsBlockFields,
            queryParamsFromQueryParamsBlock,
            queryParamsFromUrl,
        );
    } else {
        return undefined;
    }
}

function getDiagnosticForUrlNotMatchingQueryParamsBlock(
    documentUri: Uri,
    urlFieldInMethodBlock: DictionaryBlockSimpleField,
    queryParamsBlockFields: DictionaryBlockSimpleField[],
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
        range: mapToVsCodeRange(urlFieldInMethodBlock.valueRange),
        severity: DiagnosticSeverity.Error,
        relatedInformation: [
            {
                message: `'${RequestFileBlockName.QueryParams}' block`,
                location: {
                    uri: documentUri,
                    range: getRangeForFieldsInDictionaryBlock(
                        queryParamsBlockFields,
                    ),
                },
            },
        ],
        code: NonBlockSpecificDiagnosticCode.UrlFromMethodBlockNotMatchingQueryParamsBlock,
    };
}

function getRangeForFieldsInDictionaryBlock(
    fields: DictionaryBlockSimpleField[],
) {
    const sortedFields = getSortedDictionaryBlockFieldsByPosition(
        fields,
    ) as DictionaryBlockSimpleField[];

    return mapToVsCodeRange(
        new Range(
            sortedFields[0].keyRange.start,
            sortedFields[sortedFields.length - 1].valueRange.end,
        ),
    );
}

function getDiagnosticForMissingQueryParamsBlock(
    urlFieldInMethodBlock: DictionaryBlockSimpleField,
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
        range: mapToVsCodeRange(urlFieldInMethodBlock.valueRange),
        severity: DiagnosticSeverity.Warning,
        code: NonBlockSpecificDiagnosticCode.QueryParamsBlockMissing,
    };
}
