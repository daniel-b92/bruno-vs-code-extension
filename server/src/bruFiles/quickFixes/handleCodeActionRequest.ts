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
import { updatePathParamsKeysToMatchUrl } from "./updatePathParamsKeysToMatchUrl";
import { updateQueryParamsBlockToMatchUrl } from "./updateQueryParamsBlockToMatchUrl";
import { updateUrlToMatchQueryParams } from "./updateUrlToMatchQueryParams";

// TODO: Additionally sync the URL and the params blocks while typing (the quick fixes below stay as the fallback).
//  Possible approach:
//  - Do it on the client (`workspace.onDidChangeTextDocument` + `WorkspaceEdit`), since an edit sent by the server via
//    `workspace/applyEdit` can be rejected for an outdated document version while typing and always creates its own undo step.
//  - Only react to real typing (ignore undo/redo, paste, find & replace, reverts of the file and other extensions' edits),
//    and debounce, so that half-typed states (e.g. `:i` on the way to `:id`) do not change the other side.
//  - Only sync in the direction that was edited and only rename/add entries. Never delete entries that have a value
//    (e.g. because a `:id` got retyped); that stays up to the quick fix `Update 'params:path' block to match URL`.
//  - Optionally use `textDocument/linkedEditingRange` for renaming a path param / query key at both places at once
//    (the editor handles undo and races itself, but it only works if the user enables `editor.linkedEditing`).

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

    return diagnostics.flatMap((diagnostic) =>
        getFixesForDiagnostic(diagnostic.code, {
            updateUrl: () => updateUrlToMatchQueryParams(blocks),
            updateQueryParamsBlock: () =>
                updateQueryParamsBlockToMatchUrl(docHelper, blocks),
            updatePathParamsBlock: () =>
                updatePathParamsKeysToMatchUrl(docHelper, blocks),
        })
            .map(({ title, getEdits }) => ({
                title,
                edits: ([] as TextEdit[]).concat(getEdits()),
            }))
            .filter(({ edits }) => edits.length > 0)
            .map(({ title, edits }): CodeAction => ({
                title,
                kind: CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                edit: { changes: { [uri]: edits } },
            })),
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
            return [updateQueryParamsBlock];
        case NonBlockSpecificDiagnosticCode.UrlFromMethodBlockMissingPathParams:
        case NonBlockSpecificDiagnosticCode.PathParamsBlockMissingValuesFromUrl:
        case NonBlockSpecificDiagnosticCode.UrlFromMethodBlockNotMatchingPathParamsBlock:
        case NonBlockSpecificDiagnosticCode.PathParamsBlockMissing:
            return [updatePathParamsBlock];
        default:
            return [];
    }
}
