import { isScalar, Scalar, YAMLMap } from "yaml";
import {
    WithKeyAndValueRange,
    YamlMapDescriptor,
    YamlParsingError,
} from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedOAuth2AdditionalParameter,
    ParsedOAuth2Auth,
    WithKeyAndKeyRange,
} from "../interfaces";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { parseMapsFromSequence } from "../yamlSequences/parseMapsFromSequence";
import { parseIfPresent } from "../util/parseIfPresent";
import { getRangeForItem } from "../util/getRangeForItem";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import {
    AuthType,
    OAuth2AdditionalParameterPlacement,
    OAuth2AdditionalParameterProperty,
    OAuth2AdditionalParametersProperty,
    OAuth2AuthProperty,
    OAuth2CredentialsPlacement,
    OAuth2CredentialsProperty,
    OAuth2Flow,
    OAuth2ResourceOwnerProperty,
    OAuth2SettingsProperty,
    OAuth2TokenConfigProperty,
    OAuth2TokenPlacementProperty,
    OAuth2TokenSource,
} from "../../../external/yamlFormat/constants/authConstants";

type ParsedAdditionalParameters = NonNullable<
    ParsedOAuth2Auth["properties"]["additionalParameters"]
>;
type ParsedTokenConfig = NonNullable<
    ParsedOAuth2Auth["properties"]["tokenConfig"]
>;
type ParsedTokenPlacement = NonNullable<
    ParsedTokenConfig["properties"]["placement"]
>;

const mapKeys = [
    OAuth2AuthProperty.Credentials,
    OAuth2AuthProperty.ResourceOwner,
    OAuth2AuthProperty.Pkce,
    OAuth2AuthProperty.AdditionalParameters,
    OAuth2AuthProperty.TokenConfig,
    OAuth2AuthProperty.Settings,
];

/**
 * All flows share the same set of allowed keys.
 * The keys that are relevant only for specific flows are not validated against the flow.
 */
export function parseOAuth2AuthFromAuthMap(
    args: {
        authMap: YAMLMap;
        parsedType: WithKeyAndValueRange<AuthType.Oauth2>;
    },
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
): ParsedOAuth2Auth {
    const { authMap, parsedType: type } = args;
    const { getString, getMap, getEnumValue } = getValidatedMapItems(
        authMap,
        {
            scalars: {
                stringValues: Object.values(OAuth2AuthProperty).filter(
                    (key) => !mapKeys.includes(key),
                ),
                enumValues: {
                    [OAuth2AuthProperty.Flow]: Object.values(OAuth2Flow),
                },
            },
            mapValues: mapKeys,
        },
        commonArgs,
        collectedErrors,
    );

    const parseNestedMap = <T>(
        key: OAuth2AuthProperty,
        parse: (map: WithKeyAndKeyRange<YAMLMap>) => MaybeResultWithErrors<T>,
    ) => parseIfPresent(getMap(key), parse, collectedErrors);

    return {
        properties: {
            type,
            flow: getEnumValue<OAuth2Flow>(OAuth2AuthProperty.Flow),
            authorizationUrl: stripKeyFromResult(
                getString(OAuth2AuthProperty.AuthorizationUrl),
            ),
            accessTokenUrl: stripKeyFromResult(
                getString(OAuth2AuthProperty.AccessTokenUrl),
            ),
            refreshTokenUrl: stripKeyFromResult(
                getString(OAuth2AuthProperty.RefreshTokenUrl),
            ),
            callbackUrl: stripKeyFromResult(
                getString(OAuth2AuthProperty.CallbackUrl),
            ),
            scope: stripKeyFromResult(getString(OAuth2AuthProperty.Scope)),
            state: stripKeyFromResult(getString(OAuth2AuthProperty.State)),
            credentials: parseNestedMap(OAuth2AuthProperty.Credentials, (map) =>
                parseCredentials(map, commonArgs),
            ),
            resourceOwner: parseNestedMap(
                OAuth2AuthProperty.ResourceOwner,
                (map) => parseResourceOwner(map, commonArgs),
            ),
            pkce: parseNestedMap(OAuth2AuthProperty.Pkce, (map) =>
                parsePkce(map, commonArgs),
            ),
            additionalParameters: parseNestedMap(
                OAuth2AuthProperty.AdditionalParameters,
                (map) => parseAdditionalParameters(map, commonArgs),
            ),
            tokenConfig: parseNestedMap(OAuth2AuthProperty.TokenConfig, (map) =>
                parseTokenConfig(map, commonArgs),
            ),
            settings: parseNestedMap(OAuth2AuthProperty.Settings, (map) =>
                parseSettings(map, commonArgs),
            ),
        },
    };
}

function parseCredentials(
    { keyRange, value: map }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<
    NonNullable<ParsedOAuth2Auth["properties"]["credentials"]>
> {
    const errors: YamlParsingError[] = [];
    const { getString, getEnumValue } = getValidatedMapItems(
        map,
        {
            scalars: {
                stringValues: Object.values(OAuth2CredentialsProperty),
                enumValues: {
                    [OAuth2CredentialsProperty.Placement]: Object.values(
                        OAuth2CredentialsPlacement,
                    ),
                },
            },
        },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(map, commonArgs),
            properties: {
                clientId: stripKeyFromResult(
                    getString(OAuth2CredentialsProperty.ClientId),
                ),
                clientSecret: stripKeyFromResult(
                    getString(OAuth2CredentialsProperty.ClientSecret),
                ),
                placement: getEnumValue<OAuth2CredentialsPlacement>(
                    OAuth2CredentialsProperty.Placement,
                ),
            },
        },
    };
}

function parseResourceOwner(
    { keyRange, value: map }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<
    NonNullable<ParsedOAuth2Auth["properties"]["resourceOwner"]>
> {
    const errors: YamlParsingError[] = [];
    const { getString } = getValidatedMapItems(
        map,
        {
            scalars: {
                stringValues: Object.values(OAuth2ResourceOwnerProperty),
            },
        },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(map, commonArgs),
            properties: {
                username: stripKeyFromResult(
                    getString(OAuth2ResourceOwnerProperty.Username),
                ),
                password: stripKeyFromResult(
                    getString(OAuth2ResourceOwnerProperty.Password),
                ),
            },
        },
    };
}

function parsePkce(
    { keyRange, value: map }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<NonNullable<ParsedOAuth2Auth["properties"]["pkce"]>> {
    const errors: YamlParsingError[] = [];
    getValidatedMapItems(map, {}, commonArgs, errors);

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(map, commonArgs),
            properties: {},
        },
    };
}

function parseAdditionalParameters(
    { keyRange, value: map }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedAdditionalParameters> {
    const errors: YamlParsingError[] = [];
    const { getSequence } = getValidatedMapItems(
        map,
        { sequenceValues: Object.values(OAuth2AdditionalParametersProperty) },
        commonArgs,
        errors,
    );

    const parseParameters = (key: OAuth2AdditionalParametersProperty) =>
        parseIfPresent(
            getSequence(key),
            ({ value: sequence }) =>
                parseMapsFromSequence({
                    commonArgs,
                    sequence,
                    parseMap: (parameterMap, errors) =>
                        parseAdditionalParameter(
                            parameterMap,
                            commonArgs,
                            errors,
                        ),
                }),
            errors,
        );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(map, commonArgs),
            properties: {
                authorizationRequest: parseParameters(
                    OAuth2AdditionalParametersProperty.AuthorizationRequest,
                ),
                accessTokenRequest: parseParameters(
                    OAuth2AdditionalParametersProperty.AccessTokenRequest,
                ),
                refreshTokenRequest: parseParameters(
                    OAuth2AdditionalParametersProperty.RefreshTokenRequest,
                ),
            },
        },
    };
}

function parseAdditionalParameter(
    map: YAMLMap,
    commonArgs: CommonParsingArgs,
    errors: YamlParsingError[],
): ParsedOAuth2AdditionalParameter {
    const { getString, getEnumValue } = getValidatedMapItems(
        map,
        {
            scalars: {
                stringValues: Object.values(OAuth2AdditionalParameterProperty),
                enumValues: {
                    [OAuth2AdditionalParameterProperty.Placement]:
                        Object.values(OAuth2AdditionalParameterPlacement),
                },
            },
            mandatoryKeys: [
                OAuth2AdditionalParameterProperty.Name,
                OAuth2AdditionalParameterProperty.Value,
            ],
        },
        commonArgs,
        errors,
    );

    return {
        valueRange: getRangeForItem(map, commonArgs),
        properties: {
            name: stripKeyFromResult(
                getString(OAuth2AdditionalParameterProperty.Name),
            ),
            value: stripKeyFromResult(
                getString(OAuth2AdditionalParameterProperty.Value),
            ),
            placement: getEnumValue<OAuth2AdditionalParameterPlacement>(
                OAuth2AdditionalParameterProperty.Placement,
            ),
        },
    };
}

function parseTokenConfig(
    { keyRange, value: map }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedTokenConfig> {
    const errors: YamlParsingError[] = [];
    const { getString, getMap, getEnumValue } = getValidatedMapItems(
        map,
        {
            scalars: {
                stringValues: [OAuth2TokenConfigProperty.Id],
                enumValues: {
                    [OAuth2TokenConfigProperty.Source]:
                        Object.values(OAuth2TokenSource),
                },
            },
            mapValues: [OAuth2TokenConfigProperty.Placement],
        },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(map, commonArgs),
            properties: {
                id: stripKeyFromResult(getString(OAuth2TokenConfigProperty.Id)),
                placement: parseIfPresent(
                    getMap(OAuth2TokenConfigProperty.Placement),
                    (placementMap) =>
                        parseTokenPlacement(placementMap, commonArgs),
                    errors,
                ),
                source: getEnumValue<OAuth2TokenSource>(
                    OAuth2TokenConfigProperty.Source,
                ),
            },
        },
    };
}

function parseTokenPlacement(
    { keyRange, value: map }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedTokenPlacement> {
    const errors: YamlParsingError[] = [];
    const queryKey = OAuth2TokenPlacementProperty.Query;

    // An explicit `null` value for `query` (e.g. `query: null` or `query: ~`) is valid, but not supported by the generic map parsing.
    const queryWithoutValue = map.items.find(
        ({ key, value }) =>
            isScalar(key) &&
            key.value == queryKey &&
            isScalar(value) &&
            value.value === null &&
            value.source !== "",
    );
    const mapToValidate = queryWithoutValue ? (map.clone() as YAMLMap) : map;
    if (queryWithoutValue) {
        mapToValidate.delete(queryKey);
    }

    // The descriptor of the map gets recorded separately, so that the `query` key can be added to it afterwards.
    const placementDescriptors: YamlMapDescriptor[] = [];
    const { getString } = getValidatedMapItems(
        mapToValidate,
        {
            scalars: {
                stringValues: Object.values(OAuth2TokenPlacementProperty),
            },
        },
        { ...commonArgs, mapDescriptors: placementDescriptors },
        errors,
    );
    if (queryWithoutValue) {
        // The key was removed from the validated map, but it is still defined in the document.
        placementDescriptors[0].definedKeys.push({
            key: queryKey,
            keyRange: getRangeForItem(
                queryWithoutValue.key as Scalar,
                commonArgs,
            ),
            valueRange: getRangeForItem(
                queryWithoutValue.value as Scalar,
                commonArgs,
            ),
        });
    }
    commonArgs.mapDescriptors?.push(...placementDescriptors);

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(map, commonArgs),
            properties: {
                header: stripKeyFromResult(
                    getString(OAuth2TokenPlacementProperty.Header),
                ),
                query: queryWithoutValue
                    ? {
                          keyRange: getRangeForItem(
                              queryWithoutValue.key as Scalar,
                              commonArgs,
                          ),
                          value: null,
                          valueRange: getRangeForItem(
                              queryWithoutValue.value as Scalar,
                              commonArgs,
                          ),
                      }
                    : stripKeyFromResult(getString(queryKey)),
            },
        },
    };
}

function parseSettings(
    { keyRange, value: map }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<
    NonNullable<ParsedOAuth2Auth["properties"]["settings"]>
> {
    const errors: YamlParsingError[] = [];
    const { getBoolean } = getValidatedMapItems(
        map,
        {
            scalars: {
                booleanValues: Object.values(OAuth2SettingsProperty),
            },
        },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(map, commonArgs),
            properties: {
                autoFetchToken: stripKeyFromResult(
                    getBoolean(OAuth2SettingsProperty.AutoFetchToken),
                ),
                autoRefreshToken: stripKeyFromResult(
                    getBoolean(OAuth2SettingsProperty.AutoRefreshToken),
                ),
            },
        },
    };
}
