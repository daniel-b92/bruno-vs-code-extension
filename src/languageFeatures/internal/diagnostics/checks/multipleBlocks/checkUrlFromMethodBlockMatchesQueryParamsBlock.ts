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

    const methodBlocks = getAllMethodBlocks(blocks);

    if (queryParamsBlocks.length != 1 || methodBlocks.length != 1) {
        return undefined;
    }

    const methodBlock = castBlockToDictionaryBlock(methodBlocks[0]);
    const queryParamsBlock = castBlockToDictionaryBlock(queryParamsBlocks[0]);

    if (!methodBlock || !queryParamsBlock) {
        return undefined;
    }

    const urlFieldsInMethodBlock = methodBlock.content.filter(
        ({ key }) => key == MethodBlockKey.Url
    );

    const expectedUrlEnding =
        getExpectedMethodBlockUrlEndingForQueryParamsBlock(queryParamsBlock);

    if (
        urlFieldsInMethodBlock.length == 1 &&
        !urlFieldsInMethodBlock[0].value.endsWith(expectedUrlEnding)
    ) {
        return getDiagnostic(
            documentUri,
            urlFieldsInMethodBlock[0],
            expectedUrlEnding,
            queryParamsBlock
        );
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    urlFieldInMethodBlock: DictionaryBlockField,
    expectedUrlEnding: string,
    queryParamsBlock: DictionaryBlock
): DiagnosticWithCode {
    return {
        message: `URL does not match fields in '${RequestFileBlockName.QueryParams}' block. Expected URL to end with '${expectedUrlEnding}'.`,
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
