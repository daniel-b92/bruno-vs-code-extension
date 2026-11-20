import {
    BrunoFileType,
    doesRequestTypeSupportUrlParams,
    getRequestTypeField,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "@global_shared";
import { CodeAction, Diagnostic, TextEdit } from "vscode-languageserver";
import { toQuickFixes } from "../../shared/urlParamsSyncing/toQuickFixes";
import { NonBlockSpecificDiagnosticCode } from "../diagnostics/shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { updatePathParamsKeysToMatchUrl } from "../paramsBlocks/updatePathParamsKeysToMatchUrl";
import { updateQueryParamsBlockToMatchUrl } from "../paramsBlocks/updateQueryParamsBlockToMatchUrl";
import { updateUrlToMatchQueryParams } from "../paramsBlocks/updateUrlToMatchQueryParams";

export function handleCodeActionRequest({
    uri,
    fileContent,
    diagnostics,
}: {
    uri: string;
    fileContent: string;
    diagnostics: Diagnostic[];
}): CodeAction[] {
    const docHelper = new TextDocumentHelper(fileContent);
    const { blocks } = parseBruFile(docHelper, BrunoFileType.RequestFile);

    if (!doesRequestTypeSupportUrlParams(getRequestTypeField(blocks)?.value)) {
        return [];
    }

    return toQuickFixes(uri, diagnostics, ({ code }) =>
        getFixesForDiagnostic(code, {
            updateUrl: () => updateUrlToMatchQueryParams(blocks),
            updateQueryParamsBlock: () =>
                updateQueryParamsBlockToMatchUrl(docHelper, blocks),
            updatePathParamsBlock: () =>
                updatePathParamsKeysToMatchUrl(docHelper, blocks),
        }),
    );
}

function getFixesForDiagnostic(
    code: Diagnostic["code"],
    edits: {
        updateUrl: () => TextEdit | TextEdit[];
        updateQueryParamsBlock: () => TextEdit | TextEdit[];
        updatePathParamsBlock: () => TextEdit | TextEdit[];
    },
) {
    const queryParamsBlockName = RequestFileBlockName.QueryParams;
    const pathParamsBlockName = RequestFileBlockName.PathParams;

    const updateQueryParamsBlock = {
        title: `Update '${queryParamsBlockName}' block to match URL`,
        getEdits: edits.updateQueryParamsBlock,
    };
    const updatePathParamsBlock = {
        title: `Update '${pathParamsBlockName}' block to match URL`,
        getEdits: edits.updatePathParamsBlock,
    };

    switch (code) {
        case NonBlockSpecificDiagnosticCode.UrlFromMethodBlockNotMatchingQueryParamsBlock:
            return [
                {
                    title: `Update URL to match '${queryParamsBlockName}' block`,
                    getEdits: edits.updateUrl,
                },
                updateQueryParamsBlock,
            ];
        case NonBlockSpecificDiagnosticCode.QueryParamsBlockMissing:
            return [
                {
                    title: "Remove query params from URL",
                    getEdits: edits.updateUrl,
                },
                updateQueryParamsBlock,
            ];
        case NonBlockSpecificDiagnosticCode.UrlFromMethodBlockMissingPathParams:
        case NonBlockSpecificDiagnosticCode.PathParamsBlockMissingValuesFromUrl:
        case NonBlockSpecificDiagnosticCode.UrlFromMethodBlockNotMatchingPathParamsBlock:
        case NonBlockSpecificDiagnosticCode.PathParamsBlockMissing:
            return [updatePathParamsBlock];
        default:
            return [];
    }
}
