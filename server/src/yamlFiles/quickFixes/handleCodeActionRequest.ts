import {
    getYamlUrlParamsInfo,
    YamlUrlParamsInfo,
} from "../paramsSyncing/getYamlUrlParamsInfo";
import { parseRequestFile, TextDocumentHelper } from "@global_shared";
import { CodeAction, Diagnostic } from "vscode-languageserver";
import {
    FixDefinition,
    toQuickFixes,
} from "../../shared/urlParamsSyncing/toQuickFixes";
import { YamlDiagnosticCode } from "../diagnostics/yamlDiagnosticCodeEnum";
import { updatePathParamsToMatchUrl } from "../paramsSyncing/updatePathParamsToMatchUrl";
import { updateQueryParamsToMatchUrl } from "../paramsSyncing/updateQueryParamsToMatchUrl";
import { updateUrlToMatchQueryParams } from "../paramsSyncing/updateUrlToMatchQueryParams";

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
    const { result } = parseRequestFile(docHelper, {
        continueOnSyntaxErrors: false,
    });
    const info = result && getYamlUrlParamsInfo(result);

    return info
        ? toQuickFixes(uri, diagnostics, ({ code }) =>
              getFixesForDiagnostic(code, docHelper, info),
          )
        : [];
}

function getFixesForDiagnostic(
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
