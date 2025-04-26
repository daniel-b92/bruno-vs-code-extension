import { DiagnosticSeverity, Uri } from "vscode";
import {
    castBlockToDictionaryBlock,
    DictionaryBlock,
    DictionaryBlockField,
    getAllMethodBlocks,
    getExpectedMethodBlockUrlEndingForQueryParamsBlock,
    MethodBlockKey,
    RequestFileBlock,
    RequestFileBlockName,
} from "../../../../../shared";
import { DiagnosticWithCode } from "../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

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

    const expectedUrlEnding =
        getExpectedMethodBlockUrlEndingForQueryParamsBlock(queryParamsBlock);

    if (!urlField.value.endsWith(expectedUrlEnding)) {
        return getDiagnosticForUrlMissingQueryParams(
            documentUri,
            urlField,
            expectedUrlEnding,
            queryParamsBlock
        );
    } else {
        return undefined;
    }
}

function getUrlFieldFromMethodBlock(allBlocks: RequestFileBlock[]) {
    const methodBlocks = getAllMethodBlocks(allBlocks);

    if (methodBlocks.length != 1) {
        return undefined;
    }

    const methodBlock = castBlockToDictionaryBlock(methodBlocks[0]);

    if (!methodBlock) {
        return undefined;
    }

    const urlFieldsInMethodBlock = methodBlock.content.filter(
        ({ key }) => key == MethodBlockKey.Url
    );

    return urlFieldsInMethodBlock.length == 1
        ? urlFieldsInMethodBlock[0]
        : undefined;
}

function getDiagnosticForUrlMissingQueryParams(
    documentUri: Uri,
    urlFieldInMethodBlock: DictionaryBlockField,
    expectedUrlEnding: string,
    queryParamsBlock: DictionaryBlock
): DiagnosticWithCode {
    return {
        message: `URL is missing query params from '${RequestFileBlockName.QueryParams}' block. Expected URL to end with '${expectedUrlEnding}'.`,
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
        code: NonBlockSpecificDiagnosticCode.UrlFromMethodBlockMissingQueryParams,
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
