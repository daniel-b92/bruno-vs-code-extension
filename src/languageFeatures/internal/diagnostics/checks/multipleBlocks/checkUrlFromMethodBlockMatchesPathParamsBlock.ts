import { DiagnosticSeverity, Uri } from "vscode";
import {
    castBlockToDictionaryBlock,
    DictionaryBlock,
    DictionaryBlockField,
    getAllMethodBlocks,
    getExpectedMethodBlockUrlSubstringsForPathParamsBlock,
    MethodBlockKey,
    RequestFileBlock,
    RequestFileBlockName,
} from "../../../../../shared";
import { DiagnosticWithCode } from "../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkUrlFromMethodBlockMatchesPathParamsBlock(
    documentUri: Uri,
    blocks: RequestFileBlock[]
): DiagnosticWithCode | undefined {
    const pathParamsBlocks = blocks.filter(
        ({ name }) => name == RequestFileBlockName.PathParams
    );

    const methodBlocks = getAllMethodBlocks(blocks);

    if (pathParamsBlocks.length != 1 || methodBlocks.length != 1) {
        return undefined;
    }

    const methodBlock = castBlockToDictionaryBlock(methodBlocks[0]);
    const pathParamsBlock = castBlockToDictionaryBlock(pathParamsBlocks[0]);

    if (!methodBlock || !pathParamsBlock) {
        return undefined;
    }

    const urlFieldsInMethodBlock = methodBlock.content.filter(
        ({ key }) => key == MethodBlockKey.Url
    );

    if (urlFieldsInMethodBlock.length != 1) {
        return undefined;
    }

    const missingUrlSubstrings =
        getExpectedMethodBlockUrlSubstringsForPathParamsBlock(
            pathParamsBlock
        ).filter(
            (expectedSubstring) =>
                !urlFieldsInMethodBlock[0].value.includes(expectedSubstring)
        );

    if (missingUrlSubstrings.length > 0) {
        return getDiagnosticForMissingPathParams(
            documentUri,
            urlFieldsInMethodBlock[0],
            missingUrlSubstrings,
            pathParamsBlock
        );
    } else {
        return undefined;
    }
}

function getDiagnosticForMissingPathParams(
    documentUri: Uri,
    urlFieldInMethodBlock: DictionaryBlockField,
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
        }`,
        range: urlFieldInMethodBlock.valueRange,
        severity: DiagnosticSeverity.Error,
        relatedInformation: [
            {
                message: `'${RequestFileBlockName.PathParams}' block`,
                location: {
                    uri: documentUri,
                    range: pathParamsBlock.contentRange,
                },
            },
        ],
        code: NonBlockSpecificDiagnosticCode.UrlFromMethodBlockMissingPathParams,
    };
}
