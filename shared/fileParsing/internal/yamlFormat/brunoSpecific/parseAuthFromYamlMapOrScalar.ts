import { YAMLMap } from "yaml";
import {
    WithKeyAndValueRange,
    YamlParsingError,
    YamlParsingErrorCode,
} from "../../../..";
import {
    CommonParsingArgs,
    ParsedAuth,
    ParsedAkamaiEdgegridAuth,
    ParsedAuthWithType,
    ParsedApiKeyAuth,
    ParsedAwsV4Auth,
    ParsedBasicAuth,
    ParsedBearerAuth,
    ParsedDigestAuth,
    ParsedNtlmAuth,
    ParsedOAuth1Auth,
    ParsedWsseAuth,
    ParsedYamlMap,
    MaybeResultWithErrors,
    WithKeyAndKeyRange,
} from "../interfaces";
import { getMapItems } from "../yamlMaps/getMapItems";
import { recordMapDescriptor } from "../yamlMaps/recordMapDescriptor";
import { getErrorForInvalidEnumValue } from "../parsingErrors/getErrorForInvalidEnumValue";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import {
    AkamaiEdgegridAuthProperty,
    ApiKeyAuthProperty,
    ApiKeyPlacement,
    AuthType,
    AwsV4AuthProperty,
    BasicAuthProperty,
    BearerAuthProperty,
    CommonAuthMapProperties,
    DigestAuthProperty,
    inheritAuthValue,
    NtlmAuthProperty,
    OAuth1AuthProperty,
    WsseAuthProperty,
} from "../../../external/yamlFormat/constants/authConstants";
import {
    OAuth1Placement,
    OAuth1SignatureMethod,
} from "../../../../languageUtils/shared/oAuth1FieldValueEnums";
import { getRangeForItem } from "../util/getRangeForItem";
import { parseOAuth2AuthFromAuthMap } from "./parseOAuth2AuthFromAuthMap";

export function parseAuthFromYamlMapOrScalar(args: {
    commonArgs: CommonParsingArgs;
    authMapOrScalar: WithKeyAndKeyRange<YAMLMap> | WithKeyAndValueRange<string>;
}): MaybeResultWithErrors<ParsedAuth> {
    const { commonArgs, authMapOrScalar } = args;
    const { keyRange, value: authFullValue } = authMapOrScalar;
    const allErrors: YamlParsingError[] = [];

    if (typeof authFullValue == "string") {
        const { valueRange } = authMapOrScalar as WithKeyAndValueRange<string>;
        return authMapOrScalar.value == inheritAuthValue
            ? {
                  result: {
                      keyRange,
                      value: {},
                      valueRange,
                  },
                  errors: [],
              }
            : {
                  errors: [
                      {
                          message: `Invalid Scalar string for auth. Allowed is only '${inheritAuthValue}'.`,
                          range: valueRange,
                          code: YamlParsingErrorCode.Other,
                      },
                  ],
              };
    }
    const valueRange = getRangeForItem(authFullValue, commonArgs);
    const maybeAuthType = tryToParseAuthTypeField(authFullValue, commonArgs);
    if (!maybeAuthType.result) {
        return { errors: maybeAuthType.errors };
    }

    const { errors: typeParsingErrors, result: authType } = maybeAuthType;
    allErrors.push(...typeParsingErrors);

    const parsedAuth = parseAuthMapOfType(
        authType,
        authFullValue,
        allErrors,
        commonArgs,
    );
    if (!parsedAuth) {
        return { errors: allErrors };
    }

    return {
        result: { keyRange, value: parsedAuth, valueRange },
        errors: allErrors,
    };

    function tryToParseAuthTypeField(
        authMap: YAMLMap,
        commonParsingArgs: CommonParsingArgs,
    ): MaybeResultWithErrors<WithKeyAndValueRange<AuthType>> {
        const allowedTypes = Object.values(AuthType);
        const expectedKeys = {
            scalars: {
                enumValues: { [CommonAuthMapProperties.type]: allowedTypes },
            },
        };
        const { items, errors } = getMapItems(
            authMap,
            expectedKeys,
            commonParsingArgs,
        );
        const {
            missingKeys,
            validScalars: { withStringValue: validStringScalars },
        } = items;
        // If the type is valid, the map gets validated (and recorded) later on, when parsing the keys specific to the type.
        const recordDescriptorForTypeField = () =>
            recordMapDescriptor({
                items,
                expectedKeys,
                mandatoryKeys: [CommonAuthMapProperties.type],
                commonArgs: commonParsingArgs,
            });

        if (validStringScalars.length == 0 || missingKeys.length > 0) {
            recordDescriptorForTypeField();
            return {
                errors: errors.concat(
                    missingKeys.map((key) =>
                        getErrorForMissingKeyInMap({
                            ...commonParsingArgs,
                            map: authMap,
                            missingKey: key,
                        }),
                    ),
                ),
            };
        }

        const typeField = stripKeyFromResult(validStringScalars[0]);
        if (!(allowedTypes as string[]).includes(typeField.value)) {
            recordDescriptorForTypeField();
            return {
                errors: errors.concat(
                    getErrorForInvalidEnumValue(typeField, allowedTypes),
                ),
            };
        }

        return {
            result: typeField as WithKeyAndValueRange<AuthType>,
            errors,
        };
    }

    function parseAuthMapOfType(
        authType: WithKeyAndValueRange<AuthType>,
        authMap: YAMLMap,
        collectedErrors: YamlParsingError[],
        commonParsingArgs: CommonParsingArgs,
    ): ParsedAuthWithType | undefined {
        switch (authType.value) {
            case AuthType.Basic:
                return parseFlatAuthMap<ParsedBasicAuth>(
                    {
                        authMap,
                        parsedType: authType,
                        stringKeys: Object.values(BasicAuthProperty),
                    },
                    commonParsingArgs,
                    collectedErrors,
                );
            case AuthType.Bearer:
                return parseFlatAuthMap<ParsedBearerAuth>(
                    {
                        authMap,
                        parsedType: authType,
                        stringKeys: Object.values(BearerAuthProperty),
                    },
                    commonParsingArgs,
                    collectedErrors,
                );
            case AuthType.Awsv4:
                return parseFlatAuthMap<ParsedAwsV4Auth>(
                    {
                        authMap,
                        parsedType: authType,
                        stringKeys: Object.values(AwsV4AuthProperty),
                    },
                    commonParsingArgs,
                    collectedErrors,
                );
            case AuthType.Digest:
                return parseFlatAuthMap<ParsedDigestAuth>(
                    {
                        authMap,
                        parsedType: authType,
                        stringKeys: Object.values(DigestAuthProperty),
                    },
                    commonParsingArgs,
                    collectedErrors,
                );
            case AuthType.Wsse:
                return parseFlatAuthMap<ParsedWsseAuth>(
                    {
                        authMap,
                        parsedType: authType,
                        stringKeys: Object.values(WsseAuthProperty),
                    },
                    commonParsingArgs,
                    collectedErrors,
                );
            case AuthType.Ntlm:
                return parseFlatAuthMap<ParsedNtlmAuth>(
                    {
                        authMap,
                        parsedType: authType,
                        stringKeys: Object.values(NtlmAuthProperty),
                    },
                    commonParsingArgs,
                    collectedErrors,
                );
            case AuthType.Apikey:
                return parseFlatAuthMap<ParsedApiKeyAuth>(
                    {
                        authMap,
                        parsedType: authType,
                        stringKeys: Object.values(ApiKeyAuthProperty),
                        enumKeys: {
                            [ApiKeyAuthProperty.Placement]:
                                Object.values(ApiKeyPlacement),
                        },
                    },
                    commonParsingArgs,
                    collectedErrors,
                );
            case AuthType.AkamaiEdgegrid:
                return parseFlatAuthMap<ParsedAkamaiEdgegridAuth>(
                    {
                        authMap,
                        parsedType: authType,
                        stringKeys: Object.values(
                            AkamaiEdgegridAuthProperty,
                        ).filter(
                            (key) =>
                                key != AkamaiEdgegridAuthProperty.MaxBodySize,
                        ),
                        numberKeys: [AkamaiEdgegridAuthProperty.MaxBodySize],
                    },
                    commonParsingArgs,
                    collectedErrors,
                );
            case AuthType.Oauth1:
                return parseFlatAuthMap<ParsedOAuth1Auth>(
                    {
                        authMap,
                        parsedType: authType,
                        stringKeys: Object.values(OAuth1AuthProperty).filter(
                            (key) => key != OAuth1AuthProperty.IncludeBodyHash,
                        ),
                        booleanKeys: [OAuth1AuthProperty.IncludeBodyHash],
                        enumKeys: {
                            [OAuth1AuthProperty.Placement]:
                                Object.values(OAuth1Placement),
                            [OAuth1AuthProperty.SignatureMethod]: Object.values(
                                OAuth1SignatureMethod,
                            ),
                        },
                    },
                    commonParsingArgs,
                    collectedErrors,
                );
            case AuthType.Oauth2:
                return parseOAuth2AuthFromAuthMap(
                    {
                        authMap,
                        parsedType:
                            authType as WithKeyAndValueRange<AuthType.Oauth2>,
                    },
                    commonParsingArgs,
                    collectedErrors,
                );
        }
    }
}

/** The Yaml keys of an auth map. They have to match the names of the properties of the parsed type. */
type FlatAuthKey<T extends ParsedYamlMap<{ type: unknown }>> =
    keyof T["properties"] & string;

/**
 * Parses an auth map that only consists of scalar values (some of which may be restricted to a fixed set of values).
 * The names of the parsed properties are the same as the Yaml keys.
 */
function parseFlatAuthMap<T extends ParsedYamlMap<{ type: unknown }>>(
    args: {
        authMap: YAMLMap;
        parsedType: WithKeyAndValueRange<AuthType>;
        stringKeys: FlatAuthKey<T>[];
        booleanKeys?: FlatAuthKey<T>[];
        numberKeys?: FlatAuthKey<T>[];
        enumKeys?: Partial<Record<FlatAuthKey<T>, readonly string[]>>;
    },
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
): T {
    const {
        authMap,
        parsedType,
        stringKeys,
        booleanKeys = [],
        numberKeys = [],
        enumKeys = {},
    } = args;
    const { getString, getBoolean, getNumber, getEnumValue } =
        getValidatedMapItems(
            authMap,
            {
                scalars: {
                    stringValues: stringKeys,
                    booleanValues: booleanKeys,
                    numericValues: numberKeys,
                    enumValues: enumKeys as Record<string, readonly string[]>,
                },
            },
            commonArgs,
            collectedErrors,
        );

    const properties: Record<string, unknown> = { type: parsedType };
    const plainStringKeys = stringKeys.filter(
        (key) => key != CommonAuthMapProperties.type && !(key in enumKeys),
    );
    for (const key of plainStringKeys) {
        properties[key] = stripKeyFromResult(getString(key));
    }
    for (const key of booleanKeys) {
        properties[key] = stripKeyFromResult(getBoolean(key));
    }
    for (const key of numberKeys) {
        properties[key] = stripKeyFromResult(getNumber(key));
    }
    for (const key of Object.keys(enumKeys)) {
        properties[key] = getEnumValue(key);
    }

    return { properties } as unknown as T;
}
