import {
    getPathParamsFromUrl,
    getQueryParamsFromUrl,
    getUrlSubstringForQueryParams,
    HttpParamType,
    ParsedRequestFile,
    Range,
} from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { CommonDiagnosticParams } from "../../../interfaces";
import {
    getEnabledParamsOfType,
    getExpectedUrlQueryParams,
} from "../../../paramsSyncing/getYamlUrlParamsInfo";
import { YamlDiagnosticCode } from "../../yamlDiagnosticCodeEnum";

export function checkUrlMatchesParams(
    http: ParsedRequestFile["properties"]["http"],
    { filePath }: CommonDiagnosticParams,
): (Diagnostic | undefined)[] {
    const url = http?.properties.url;

    if (!url) {
        return [];
    }

    const enabledParams = http.properties.params?.value.enabled ?? [];

    return [checkPathParams(), checkQueryParams()];

    function checkPathParams() {
        const pathParams = getEnabledParamsOfType(
            enabledParams,
            HttpParamType.Path,
        );
        const namesFromParams = pathParams.map(({ name }) => name);
        const namesFromUrl = getPathParamsFromUrl(url!.value);

        const missingInUrl = namesFromParams.filter(
            (name) => !namesFromUrl.includes(name),
        );
        const missingInParams = namesFromUrl.filter(
            (name) => !namesFromParams.includes(name),
        );

        const messages = [
            missingInUrl.length > 0
                ? `Path params missing in the URL: ${formatList(missingInUrl)}`
                : undefined,
            missingInParams.length > 0
                ? `Path params from the URL without a matching entry in 'params': ${formatList(missingInParams)}`
                : undefined,
        ].filter((message) => message != undefined);

        return messages.length > 0
            ? getDiagnostic(
                  messages.join(". "),
                  YamlDiagnosticCode.UrlNotMatchingPathParams,
                  pathParams.map(({ entry }) => entry.valueRange),
              )
            : undefined;
    }

    function checkQueryParams() {
        const queryParams = getEnabledParamsOfType(
            enabledParams,
            HttpParamType.Query,
        );
        const queryParamsFromParams = getExpectedUrlQueryParams(queryParams);
        const queryParamsFromUrl =
            getQueryParamsFromUrl(url!.value) ?? new URLSearchParams();

        return queryParamsFromUrl.toString() == queryParamsFromParams.toString()
            ? undefined
            : getDiagnostic(
                  `Query params from URL '${getUrlSubstringForQueryParams(
                      queryParamsFromUrl,
                  )}' do not match query params from 'params' '${getUrlSubstringForQueryParams(
                      queryParamsFromParams,
                  )}'`,
                  YamlDiagnosticCode.UrlNotMatchingQueryParams,
                  queryParams.map(({ entry }) => entry.valueRange),
              );
    }

    function getDiagnostic(
        message: string,
        code: YamlDiagnosticCode,
        paramRanges: Range[],
    ): Diagnostic {
        return {
            message,
            code,
            range: url!.valueRange,
            severity: DiagnosticSeverity.Warning,
            relatedInformation: paramRanges.map((range) => ({
                message: "Param definition",
                location: { uri: URI.file(filePath).toString(), range },
            })),
        };
    }
}

function formatList(values: string[]) {
    return values.map((value) => `'${value}'`).join(", ");
}
