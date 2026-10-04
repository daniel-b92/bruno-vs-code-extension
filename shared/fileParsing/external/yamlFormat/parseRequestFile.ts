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
    RequestFileHttpSectionProperty,
    RequestFileRuntimeProperty,
    RequestFileWebsocketSectionProperty,
    TopLevelRequestFileProperty,
} from "./constants/requestFileConstants";
import { FileInfoProperty, FileInfoType } from "./constants/sharedConstants";
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
import {
    parseWebsocketMessageContent,
    parseWebsocketMessagesFromSequence,
} from "../../internal/yamlFormat/brunoSpecific/parseWebsocketMessagesFromSequence";
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
    const websocketMap = getMap(TopLevelRequestFileProperty.Websocket);
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
    const websocket = websocketMap
        ? parseWebsocketSection(websocketMap, commonArgs, collectedErrors)
        : undefined;
    const runtime = runtimeMap
        ? parseRuntimeSection(runtimeMap, commonArgs, collectedErrors)
        : undefined;
    const docs = stripKeyFromResult(
        getString(TopLevelRequestFileProperty.Docs),
    );
    const settings = parseIfPresent(
        getMap(TopLevelRequestFileProperty.Settings),
        (settingsMap) =>
            parseSettingsFromYamlMap(
                settingsMap,
                commonArgs,
                getRequestType(maybeTopLevelMap.map),
            ),
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
                websocket,
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
    section: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
) {
    const { getSequence, getMap, ...parsed } = parseRequestTypeSection({
        section,
        commonArgs,
        collectedErrors,
        additionalSequenceKeys: [RequestFileHttpSectionProperty.params],
        parseBody: (bodyMap) => parseBodyFromYamlMap(bodyMap, commonArgs),
    });

    return {
        ...parsed,
        properties: {
            ...parsed.properties,
            params: parseIfPresent(
                getSequence(RequestFileHttpSectionProperty.params),
                ({ value }) => parseParamsFromSequence(value, commonArgs),
                collectedErrors,
            ),
        },
    };
}

function parseGraphqlSection(
    section: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
) {
    const { getSequence, getMap, ...parsed } = parseRequestTypeSection({
        section,
        commonArgs,
        collectedErrors,
        parseBody: (bodyMap) =>
            parseGraphqlBodyFromYamlMap(bodyMap, commonArgs),
    });

    return parsed;
}

function parseWebsocketSection(
    section: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
) {
    const { getSequence, getMap, ...parsed } = parseRequestTypeSection({
        section,
        commonArgs,
        collectedErrors,
        additionalSequenceKeys: [RequestFileWebsocketSectionProperty.message],
        // Message can either be a map for a single message or a sequence of messages.
        additionalMapKeys: [RequestFileWebsocketSectionProperty.message],
    });

    const messagesFromSequence = parseIfPresent(
        getSequence(RequestFileWebsocketSectionProperty.message),
        ({ value }) => parseWebsocketMessagesFromSequence(value, commonArgs),
        collectedErrors,
    );
    const singleMessageContent = parseIfPresent(
        getMap(RequestFileWebsocketSectionProperty.message),
        (messageMap) => parseWebsocketMessageContent(messageMap, commonArgs),
        collectedErrors,
    );

    return {
        ...parsed,
        properties: {
            ...parsed.properties,
            // A single message is normalized to a list with one entry, which has no title or selection state.
            message:
                messagesFromSequence ??
                (singleMessageContent
                    ? [
                          {
                              valueRange: singleMessageContent.valueRange,
                              missingProperties: [],
                              properties: { message: singleMessageContent },
                          },
                      ]
                    : undefined),
        },
    };
}

/**
 * Parses the properties that are shared between the sections of all request types (method, url, headers, body, auth).
 * The keys of these properties are the same for all request types.
 */
function parseRequestTypeSection<TBody>({
    section: { keyRange, value: sectionMap },
    commonArgs,
    collectedErrors,
    additionalSequenceKeys = [],
    additionalMapKeys = [],
    parseBody,
}: {
    section: WithKeyAndKeyRange<YAMLMap>;
    commonArgs: CommonParsingArgs;
    collectedErrors: YamlParsingError[];
    additionalSequenceKeys?: string[];
    additionalMapKeys?: string[];
    /** Method and body are only valid for request types that define a `parseBody` function. */
    parseBody?: (
        bodyMap: WithKeyAndKeyRange<YAMLMap>,
    ) => MaybeResultWithErrors<TBody>;
}) {
    const { getString, getMap, getSequence, missingProperties } =
        getValidatedMapItems(
            sectionMap,
            {
                scalars: {
                    stringValues: [
                        ...(parseBody
                            ? [RequestFileHttpSectionProperty.method]
                            : []),
                        RequestFileHttpSectionProperty.url,
                        // Auth can either be a scalar string with the value 'inherit' or a map with a specific type.
                        RequestFileHttpSectionProperty.auth,
                    ],
                },
                mapValues: [
                    ...(parseBody ? [RequestFileHttpSectionProperty.body] : []),
                    RequestFileHttpSectionProperty.auth,
                    ...additionalMapKeys,
                ],
                sequenceValues: [
                    RequestFileHttpSectionProperty.headers,
                    ...additionalSequenceKeys,
                ],
            },
            commonArgs,
            collectedErrors,
        );

    return {
        keyRange,
        valueRange: getRangeForItem(sectionMap, commonArgs),
        missingProperties,
        getSequence,
        getMap,
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
            body:
                parseBody &&
                parseIfPresent(
                    getMap(RequestFileHttpSectionProperty.body),
                    parseBody,
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
    const type = getRequestType(topLevelMap);

    return typeof type == "string" && requestTypeSections.includes(type)
        ? requestTypeSections.filter((section) => section != type)
        : [];
}

function getRequestType(topLevelMap: YAMLMap): FileInfoType | undefined {
    const type = topLevelMap.getIn([
        TopLevelRequestFileProperty.Info,
        FileInfoProperty.Type,
    ]);

    return Object.values(FileInfoType).find((t) => t == type);
}
