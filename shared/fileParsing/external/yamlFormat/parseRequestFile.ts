import { isScalar, YAMLMap } from "yaml";
import {
    BrunoFileType,
    ParsedInfoForRequestFile,
    ParsedRequestFile,
    TextDocumentHelper,
    YamlParsingError,
} from "../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedRequestFileAppSection,
    WithKeyAndKeyRange,
} from "../../internal/yamlFormat/interfaces";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { getValidatedMapItems } from "../../internal/yamlFormat/yamlMaps/getValidatedMapItems";
import {
    RequestFileAppProperty,
    RequestFileGraphqlSectionProperty,
    RequestFileHttpSectionProperty,
    RequestFileRuntimeProperty,
    TopLevelRequestFileProperty,
} from "./constants/requestFileConstants";
import { FileInfoProperty } from "./constants/sharedConstants";
import { parseFileInfoFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseFileInfoFromYamlMap";
import { parseSettingsFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseSettingsFromYamlMap";
import { stripKeyFromResult } from "../../internal/yamlFormat/util/stripKeyFromResult";
import { parseIfPresent } from "../../internal/yamlFormat/util/parseIfPresent";
import { getRangeForItem } from "../../internal/yamlFormat/util/getRangeForItem";
import { parseVariablesFromYamlSequence } from "../../internal/yamlFormat/brunoSpecific/parseVariablesFromYamlSequence";
import { parseScriptsFromYamlSequence } from "../../internal/yamlFormat/brunoSpecific/parseScriptsFromYamlSequence";
import { parseActionsFromYamlSequence } from "../../internal/yamlFormat/brunoSpecific/parseActionsFromYamlSequence";
import { parseAssertionsFromYamlSequence } from "../../internal/yamlFormat/brunoSpecific/parseAssertionsFromYamlSequence";
import { parseHeadersFromSequence } from "../../internal/yamlFormat/brunoSpecific/parseHeadersFromSequence";
import { parseParamsFromSequence } from "../../internal/yamlFormat/brunoSpecific/parseParamsFromSequence";
import { parseBodyFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseBodyFromYamlMap";
import { parseGraphqlBodyFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseGraphqlBodyFromYamlMap";
import { parseAuthFromYamlMapOrScalar } from "../../internal/yamlFormat/brunoSpecific/parseAuthFromYamlMapOrScalar";

export function parseRequestFile(
    docHelper: TextDocumentHelper,
): MaybeResultWithErrors<ParsedRequestFile> {
    const commonArgs: CommonParsingArgs = {
        docHelper,
        fullDocumentRange: docHelper.getTextRange(),
    };
    const collectedErrors: YamlParsingError[] = [];

    const maybeTopLevelMap = parseDocumentIntoYamlMap(commonArgs);
    if ("errors" in maybeTopLevelMap) {
        return maybeTopLevelMap;
    }

    const sectionsForOtherTypes = getSectionsForOtherRequestTypes(
        maybeTopLevelMap.map,
    );
    const { getString, getMap, missingProperties } = getValidatedMapItems(
        maybeTopLevelMap.map,
        {
            // Docs section is always a scalar for request files.
            scalars: { stringValues: [TopLevelRequestFileProperty.Docs] },
            // Examples section is always a sequence for request files.
            sequenceValues: [TopLevelRequestFileProperty.Examples],
            mapValues: Object.values(TopLevelRequestFileProperty).filter(
                (prop) =>
                    prop != TopLevelRequestFileProperty.Docs &&
                    prop != TopLevelRequestFileProperty.Examples &&
                    !sectionsForOtherTypes.includes(prop),
            ),
            // These get reported by the check for the request type matching the sections.
            silentlyAllowedKeys: sectionsForOtherTypes,
            // info is the only mandatory top level property.
            mandatoryKeys: [TopLevelRequestFileProperty.Info],
        },
        commonArgs,
        collectedErrors,
    );

    const httpMap = getMap(TopLevelRequestFileProperty.Http);
    const graphqlMap = getMap(TopLevelRequestFileProperty.Graphql);
    const runtimeMap = getMap(TopLevelRequestFileProperty.Runtime);
    const appMap = getMap(TopLevelRequestFileProperty.App);

    const info: ParsedInfoForRequestFile | undefined = parseIfPresent(
        getMap(TopLevelRequestFileProperty.Info),
        (infoMap) =>
            parseFileInfoFromYamlMap({
                infoMap,
                commonArgs,
                fileType: BrunoFileType.RequestFile,
            }),
        collectedErrors,
    );
    const http = httpMap
        ? parseHttpSection(httpMap, commonArgs, collectedErrors)
        : undefined;
    const graphql = graphqlMap
        ? parseGraphqlSection(graphqlMap, commonArgs, collectedErrors)
        : undefined;
    const runtime = runtimeMap
        ? parseRuntimeSection(runtimeMap, commonArgs, collectedErrors)
        : undefined;
    const docs = stripKeyFromResult(
        getString(TopLevelRequestFileProperty.Docs),
    );
    const settings = parseIfPresent(
        getMap(TopLevelRequestFileProperty.Settings),
        (settingsMap) => parseSettingsFromYamlMap(settingsMap, commonArgs),
        collectedErrors,
    );
    const app = appMap
        ? parseAppSection(appMap, commonArgs, collectedErrors)
        : undefined;
    // Also includes sections with an invalid value, so that they do not get reported as missing.
    const requestTypeSectionNames: string[] = [
        TopLevelRequestFileProperty.Http,
        TopLevelRequestFileProperty.Graphql,
        TopLevelRequestFileProperty.Grpc,
        TopLevelRequestFileProperty.Websocket,
    ];
    const requestTypeSections = maybeTopLevelMap.map.items.flatMap(({ key }) =>
        isScalar(key) &&
        typeof key.value == "string" &&
        requestTypeSectionNames.includes(key.value)
            ? [
                  {
                      name: key.value,
                      keyRange: getRangeForItem(key, commonArgs),
                  },
              ]
            : [],
    );

    return {
        errors: collectedErrors,
        result: {
            properties: {
                info,
                http,
                graphql,
                runtime,
                docs,
                settings,
                app,
                requestTypeSections,
            },
            missingProperties,
        },
    };
}

function parseHttpSection(
    { keyRange, value: httpMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
) {
    const { getString, getMap, getSequence, missingProperties } =
        getValidatedMapItems(
            httpMap,
            {
                scalars: {
                    stringValues: [
                        RequestFileHttpSectionProperty.method,
                        RequestFileHttpSectionProperty.url,
                        // Auth can either be a scalar string with the value 'inherit' or a map with a specific type.
                        RequestFileHttpSectionProperty.auth,
                    ],
                },
                mapValues: [
                    RequestFileHttpSectionProperty.body,
                    RequestFileHttpSectionProperty.auth,
                ],
                sequenceValues: [
                    RequestFileHttpSectionProperty.headers,
                    RequestFileHttpSectionProperty.params,
                ],
            },
            commonArgs,
            collectedErrors,
        );

    return {
        keyRange,
        valueRange: getRangeForItem(httpMap, commonArgs),
        missingProperties,
        properties: {
            method: stripKeyFromResult(
                getString(RequestFileHttpSectionProperty.method),
            ),
            url: stripKeyFromResult(
                getString(RequestFileHttpSectionProperty.url),
            ),
            headers: parseIfPresent(
                getSequence(RequestFileHttpSectionProperty.headers),
                ({ value: headersSequence }) =>
                    parseHeadersFromSequence({ commonArgs, headersSequence }),
                collectedErrors,
            ),
            params: parseIfPresent(
                getSequence(RequestFileHttpSectionProperty.params),
                ({ value }) => parseParamsFromSequence(value, commonArgs),
                collectedErrors,
            ),
            body: parseIfPresent(
                getMap(RequestFileHttpSectionProperty.body),
                (bodyMap) => parseBodyFromYamlMap(bodyMap, commonArgs),
                collectedErrors,
            ),
            auth: parseIfPresent(
                getString(RequestFileHttpSectionProperty.auth) ??
                    getMap(RequestFileHttpSectionProperty.auth),
                (authMapOrScalar) =>
                    parseAuthFromYamlMapOrScalar({
                        commonArgs,
                        authMapOrScalar,
                    }),
                collectedErrors,
            ),
        },
    };
}

function parseGraphqlSection(
    { keyRange, value: graphqlMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
): NonNullable<ParsedRequestFile["properties"]["graphql"]> {
    const { getString, getMap, getSequence, missingProperties } =
        getValidatedMapItems(
            graphqlMap,
            {
                scalars: {
                    stringValues: [
                        RequestFileGraphqlSectionProperty.method,
                        RequestFileGraphqlSectionProperty.url,
                        // Auth can either be a scalar string with the value 'inherit' or a map with a specific type.
                        RequestFileGraphqlSectionProperty.auth,
                    ],
                },
                mapValues: [
                    RequestFileGraphqlSectionProperty.body,
                    RequestFileGraphqlSectionProperty.auth,
                ],
                sequenceValues: [RequestFileGraphqlSectionProperty.headers],
            },
            commonArgs,
            collectedErrors,
        );

    return {
        keyRange,
        valueRange: getRangeForItem(graphqlMap, commonArgs),
        missingProperties,
        properties: {
            method: stripKeyFromResult(
                getString(RequestFileGraphqlSectionProperty.method),
            ),
            url: stripKeyFromResult(
                getString(RequestFileGraphqlSectionProperty.url),
            ),
            headers: parseIfPresent(
                getSequence(RequestFileGraphqlSectionProperty.headers),
                ({ value: headersSequence }) =>
                    parseHeadersFromSequence({ commonArgs, headersSequence }),
                collectedErrors,
            ),
            body: parseIfPresent(
                getMap(RequestFileGraphqlSectionProperty.body),
                (bodyMap) => parseGraphqlBodyFromYamlMap(bodyMap, commonArgs),
                collectedErrors,
            ),
            auth: parseIfPresent(
                getString(RequestFileGraphqlSectionProperty.auth) ??
                    getMap(RequestFileGraphqlSectionProperty.auth),
                (authMapOrScalar) =>
                    parseAuthFromYamlMapOrScalar({
                        commonArgs,
                        authMapOrScalar,
                    }),
                collectedErrors,
            ),
        },
    };
}

function parseAppSection(
    { keyRange, value: appMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
): ParsedRequestFileAppSection {
    const { getString, getBoolean, missingProperties } = getValidatedMapItems(
        appMap,
        {
            scalars: {
                stringValues: [RequestFileAppProperty.Code],
                booleanValues: [RequestFileAppProperty.Enabled],
            },
            // All properties are mandatory for the app section.
            mandatoryKeys: Object.values(RequestFileAppProperty),
        },
        commonArgs,
        collectedErrors,
    );

    return {
        missingProperties,
        keyRange,
        valueRange: getRangeForItem(appMap, commonArgs),
        properties: {
            code: stripKeyFromResult(getString(RequestFileAppProperty.Code)),
            enabled: stripKeyFromResult(
                getBoolean(RequestFileAppProperty.Enabled),
            ),
        },
    };
}

function parseRuntimeSection(
    { keyRange, value: runtimeMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
) {
    const { getSequence, missingProperties } = getValidatedMapItems(
        runtimeMap,
        {
            // All properties are sequences for the runtime section. None of them are mandatory.
            sequenceValues: Object.values(RequestFileRuntimeProperty),
        },
        commonArgs,
        collectedErrors,
    );

    return {
        keyRange,
        valueRange: getRangeForItem(runtimeMap, commonArgs),
        missingProperties,
        properties: {
            variables: parseIfPresent(
                getSequence(RequestFileRuntimeProperty.Variables),
                ({ value }) =>
                    parseVariablesFromYamlSequence(value, commonArgs),
                collectedErrors,
            ),
            scripts: parseIfPresent(
                getSequence(RequestFileRuntimeProperty.Scripts),
                ({ value }) => parseScriptsFromYamlSequence(value, commonArgs),
                collectedErrors,
            ),
            assertions: parseIfPresent(
                getSequence(RequestFileRuntimeProperty.Assertions),
                ({ value }) =>
                    parseAssertionsFromYamlSequence(value, commonArgs),
                collectedErrors,
            ),
            actions: parseIfPresent(
                getSequence(RequestFileRuntimeProperty.Actions),
                ({ value }) => parseActionsFromYamlSequence(value, commonArgs),
                collectedErrors,
            ),
        },
    };
}

/**
 * Determines the request type sections that are not valid for the type defined in the `info` section.
 * If the type cannot be determined, no section is excluded.
 */
function getSectionsForOtherRequestTypes(topLevelMap: YAMLMap): string[] {
    const requestTypeSections: string[] = [
        TopLevelRequestFileProperty.Http,
        TopLevelRequestFileProperty.Graphql,
        TopLevelRequestFileProperty.Grpc,
        TopLevelRequestFileProperty.Websocket,
    ];
    const type = topLevelMap.getIn([
        TopLevelRequestFileProperty.Info,
        FileInfoProperty.Type,
    ]);

    return typeof type == "string" && requestTypeSections.includes(type)
        ? requestTypeSections.filter((section) => section != type)
        : [];
}
