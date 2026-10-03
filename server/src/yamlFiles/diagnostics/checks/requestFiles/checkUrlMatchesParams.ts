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

export function checkUrlMatchesParams(
    http: ParsedRequestFile["properties"]["http"],
    { filePath }: CommonDiagnosticParams,
): (Diagnostic | undefined)[] {
    const url = http?.properties.url;

    if (!url) {
        return [];
    }

    const enabledParams = (http.properties.params ?? []).filter(
        ({ properties: { disabled } }) => !disabled.effectiveValue,
    );
    const getParamsWithType = (type: HttpParamType) =>
        enabledParams.filter(
            ({ properties: { type: paramType, name } }) =>
                paramType?.value == type && name,
        );

    return [checkPathParams(), checkQueryParams()];

    function checkPathParams() {
        const pathParams = getParamsWithType(HttpParamType.Path);
        const namesFromParams = pathParams.map(
            ({ properties: { name } }) => name!.value,
        );
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
                  pathParams.map(({ valueRange }) => valueRange),
              )
            : undefined;
    }

    function checkQueryParams() {
        const queryParams = getParamsWithType(HttpParamType.Query);
        const queryParamsFromParams = new URLSearchParams(
            queryParams
                .map(
                    ({ properties: { name, value } }) =>
                        `${name!.value}=${value?.value ?? ""}`,
                )
                .join("&"),
        );
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
                  queryParams.map(({ valueRange }) => valueRange),
              );
    }

    function getDiagnostic(message: string, paramRanges: Range[]): Diagnostic {
        return {
            message,
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
