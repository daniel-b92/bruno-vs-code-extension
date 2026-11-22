import {
    getYamlUrlParamsInfo,
    YamlUrlParamsInfo,
} from "../paramsSyncing/getYamlUrlParamsInfo";
import {
    BrunoFileType,
    parseRequestFile,
    TextDocumentHelper,
} from "@global_shared";
import { CodeAction, Diagnostic, TextEdit } from "vscode-languageserver";
import {
    FixDefinition,
    toQuickFixes,
} from "../../shared/urlParamsSyncing/toQuickFixes";
import { YamlDiagnosticCode } from "../diagnostics/yamlDiagnosticCodeEnum";
import { updatePathParamsToMatchUrl } from "../paramsSyncing/updatePathParamsToMatchUrl";
import { updateQueryParamsToMatchUrl } from "../paramsSyncing/updateQueryParamsToMatchUrl";
import { updateUrlToMatchQueryParams } from "../paramsSyncing/updateUrlToMatchQueryParams";
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
    // Query params and path params only exist in request files.
    const info =
        fileType == BrunoFileType.RequestFile
            ? getUrlParamsInfo(docHelper)
            : undefined;

    return toQuickFixes(uri, diagnostics, (diagnostic) => [
        ...getIgnoredKeyFixes(diagnostic),
        ...(info ? getUrlParamsFixes(diagnostic.code, docHelper, info) : []),
    ]);
}

function getUrlParamsInfo(docHelper: TextDocumentHelper) {
    const { result } = parseRequestFile(docHelper, {
        continueOnSyntaxErrors: false,
    });

    return result && getYamlUrlParamsInfo(result);
}

function getIgnoredKeyFixes({
    code,
    data,
}: Pick<Diagnostic, "code" | "data">): FixDefinition[] {
    if (code != YamlDiagnosticCode.IgnoredOAuth2Key) {
        return [];
    }
    const { key, removalRange } = data as IgnoredOAuth2KeyDiagnosticData;

    return [
        {
            // Fixes with the same title are only offered once, so the title needs to differ per key.
            title: `Remove key '${key}'`,
            getEdits: () => TextEdit.del(removalRange),
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
