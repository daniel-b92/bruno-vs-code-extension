import {
    BrunoFileType,
    doesRequestTypeSupportUrlParams,
    getRequestTypeField,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "@global_shared";
import {
    CodeAction,
    CodeActionKind,
    Diagnostic,
    TextEdit,
} from "vscode-languageserver";
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

    const actionsByTitle = new Map<string, CodeAction>();

    diagnostics.forEach((diagnostic) => {
        getFixesForDiagnostic(diagnostic.code, {
            updateUrl: () => updateUrlToMatchQueryParams(blocks),
            updateQueryParamsBlock: () =>
                updateQueryParamsBlockToMatchUrl(docHelper, blocks),
            updatePathParamsBlock: () =>
                updatePathParamsKeysToMatchUrl(docHelper, blocks),
        }).forEach(({ title, getEdits }) => {
            const existingAction = actionsByTitle.get(title);

            // Different diagnostics can share the same fix, which must only be offered once.
            if (existingAction) {
                existingAction.diagnostics?.push(diagnostic);
                return;
            }

            const edits = ([] as TextEdit[]).concat(getEdits());

            if (edits.length > 0) {
                actionsByTitle.set(title, {
                    title,
                    kind: CodeActionKind.QuickFix,
                    diagnostics: [diagnostic],
                    edit: { changes: { [uri]: edits } },
                });
            }
        });
    });

    return Array.from(actionsByTitle.values());
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
