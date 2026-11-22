import {
    getYamlUrlParamsInfo,
    YamlUrlParamsInfo,
} from "../paramsSyncing/getYamlUrlParamsInfo";
import {
    BrunoFileType,
    ParsedYamlDocument,
    parseRequestFile,
    parseYamlDocument,
    Position,
    TextDocumentHelper,
} from "@global_shared";
import { CodeAction, Diagnostic } from "vscode-languageserver";
import {
    FixDefinition,
    toQuickFixes,
} from "../../shared/urlParamsSyncing/toQuickFixes";
import { YamlDiagnosticCode } from "../diagnostics/yamlDiagnosticCodeEnum";
import { updatePathParamsToMatchUrl } from "../paramsSyncing/updatePathParamsToMatchUrl";
import { updateQueryParamsToMatchUrl } from "../paramsSyncing/updateQueryParamsToMatchUrl";
import { updateUrlToMatchQueryParams } from "../paramsSyncing/updateUrlToMatchQueryParams";
import { getEditToRemoveYamlKey } from "./getEditToRemoveYamlKey";
import { IgnoredOAuth2KeyDiagnosticData } from "../diagnostics/shared/checkOAuth2KeysMatchFlow";

export function handleCodeActionRequest({
    uri,
    fileContent,
    diagnostics,
    fileType,
}: {
    uri: string;
    fileContent: string;
    diagnostics: Diagnostic[];
    fileType: BrunoFileType;
}): CodeAction[] {
    const docHelper = new TextDocumentHelper(fileContent);
    let parsedDocument: ParsedYamlDocument | undefined;
    const getParsedDocument = () =>
        (parsedDocument ??= parseYamlDocument(fileContent));
    // Query params and path params only exist in request files.
    const info =
        fileType == BrunoFileType.RequestFile
            ? getUrlParamsInfo(docHelper)
            : undefined;

    return toQuickFixes(uri, diagnostics, (diagnostic) => [
        ...getIgnoredKeyFixes(diagnostic, docHelper, getParsedDocument),
        ...(info ? getUrlParamsFixes(diagnostic.code, docHelper, info) : []),
    ]);
}

function getUrlParamsInfo(docHelper: TextDocumentHelper) {
    const { result } = parseRequestFile(docHelper, {
        continueOnSyntaxErrors: false,
    });

    return result && getYamlUrlParamsInfo(result);
}

function getIgnoredKeyFixes(
    { code, data, range }: Diagnostic,
    docHelper: TextDocumentHelper,
    getParsedDocument: () => ParsedYamlDocument,
): FixDefinition[] {
    if (code != YamlDiagnosticCode.IgnoredOAuth2Key) {
        return [];
    }
    const key = (data as Partial<IgnoredOAuth2KeyDiagnosticData> | undefined)
        ?.key;
    if (!key) {
        return [];
    }
    // The edit is calculated from the current file content, because the data of a diagnostic is not updated when the file changes.
    const removal = getEditToRemoveYamlKey(
        docHelper.getText(),
        getParsedDocument(),
        docHelper.getOffsetForPosition(
            new Position(range.start.line, range.start.character),
        ),
    );
    if (!removal) {
        return [];
    }

    return [
        {
            // Fixes with the same title are only offered once, so the title needs to differ per key.
            title: removal.removedParentKey
                ? `Remove key '${key}' and the resulting empty '${removal.removedParentKey}'`
                : `Remove key '${key}'`,
            getEdits: () => removal.edit,
        },
    ];
}

function getUrlParamsFixes(
    code: Diagnostic["code"],
    docHelper: TextDocumentHelper,
    info: YamlUrlParamsInfo,
): FixDefinition[] {
    switch (code) {
        case YamlDiagnosticCode.UrlNotMatchingQueryParams:
            return [
                {
                    title: "Update URL to match query params in 'params'",
                    getEdits: () =>
                        updateUrlToMatchQueryParams(docHelper, info),
                },
                {
                    title: "Update query params in 'params' to match URL",
                    getEdits: () =>
                        updateQueryParamsToMatchUrl(docHelper, info),
                },
            ];
        case YamlDiagnosticCode.UrlNotMatchingPathParams:
            return [
                {
                    title: "Update path params in 'params' to match URL",
                    getEdits: () => updatePathParamsToMatchUrl(docHelper, info),
                },
            ];
        default:
            return [];
    }
}
