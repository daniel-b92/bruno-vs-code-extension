import {
    HttpParamType,
    ParsedHttpParam,
    ParsedRequestFile,
    WithKeyAndValueRange,
} from "@global_shared";

export type ParsedHttpSection = NonNullable<
    ParsedRequestFile["properties"]["http"]
>;

export interface ParamWithName {
    entry: ParsedHttpParam;
    name: string;
    value: string;
}

export interface YamlUrlParamsInfo {
    http: ParsedHttpSection;
    url: WithKeyAndValueRange<string>;
    params: ParsedHttpSection["properties"]["params"];
    /** All entries of `params` (enabled and disabled), sorted by position. */
    allEntries: ParsedHttpParam[];
    enabledQueryParams: ParamWithName[];
    enabledPathParams: ParamWithName[];
}

/**
 * Collects the information that is needed for syncing the URL and the `params` of a Yaml request file.
 * Only `http` requests are supported, since no other request type has `params`.
 *
 * @returns `undefined`, if the syncing is not possible: e.g. if there is no URL or if any entry of `params` is invalid.
 */
export function getYamlUrlParamsInfo(
    parsed: ParsedRequestFile,
): YamlUrlParamsInfo | undefined {
    const { http, requestTypeSections } = parsed.properties;
    const url = http?.properties.url;
    const params = http?.properties.params;

    if (
        !http ||
        !url ||
        requestTypeSections.filter(({ name }) => name == "http").length != 1
    ) {
        return undefined;
    }

    const allEntries = sortByPosition(
        [...(params?.value.enabled ?? []), ...(params?.value.disabled ?? [])],
        ({ valueRange }) => valueRange,
    );

    if (
        allEntries.some(
            ({ properties: { name, type } }) => name === undefined || !type,
        )
    ) {
        return undefined;
    }

    const enabledEntries = params?.value.enabled ?? [];

    return {
        http,
        url,
        params,
        allEntries,
        enabledQueryParams: getEnabledParamsOfType(
            enabledEntries,
            HttpParamType.Query,
        ),
        enabledPathParams: getEnabledParamsOfType(
            enabledEntries,
            HttpParamType.Path,
        ),
    };
}

/** Returns the entries that have the given type and a name, sorted by position. */
export function getEnabledParamsOfType(
    enabledEntries: ParsedHttpParam[],
    type: HttpParamType,
): ParamWithName[] {
    return sortByPosition(
        enabledEntries.flatMap((entry) => {
            const { name, value, type: paramType } = entry.properties;

            return paramType?.value == type && name
                ? [{ entry, name: name.value, value: value?.value ?? "" }]
                : [];
        }),
        ({ entry }) => entry.valueRange,
    );
}

/** The query params that the URL is expected to have for the given enabled query params. */
export function getExpectedUrlQueryParams(queryParams: ParamWithName[]) {
    return new URLSearchParams(
        queryParams.map(({ name, value }) => `${name}=${value}`).join("&"),
    );
}

function sortByPosition<T>(
    items: T[],
    getRange: (item: T) => ParsedHttpParam["valueRange"],
) {
    return [...items].sort(
        (a, b) =>
            getRange(a).start.line - getRange(b).start.line ||
            getRange(a).start.character - getRange(b).start.character,
    );
}
