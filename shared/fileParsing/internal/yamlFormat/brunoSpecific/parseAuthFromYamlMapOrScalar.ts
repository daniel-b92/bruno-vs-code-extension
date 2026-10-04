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
    WithKeyKeyRangeAndValueRange,
    WithKeyAndKeyRange,
} from "../interfaces";
import { getMapItems } from "../yamlMaps/getMapItems";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
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
    authMapOrScalar:
        WithKeyAndKeyRange<YAMLMap> | WithKeyKeyRangeAndValueRange<string>;
}): MaybeResultWithErrors<ParsedAuth> {
    const { commonArgs, authMapOrScalar } = args;
    const { keyRange, value: authFullValue } = authMapOrScalar;
    const allErrors: YamlParsingError[] = [];

    if (typeof authFullValue == "string") {
        const { valueRange } =
            authMapOrScalar as WithKeyKeyRangeAndValueRange<string>;
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
        const {
            items: {
                missingKeys,
                validScalars: { withStringValue: validStringScalars },
            },
            errors,
        } = getMapItems(
            authMap,
            { scalars: { stringValues: [CommonAuthMapProperties.type] } },
            commonParsingArgs,
        );

        if (validStringScalars.length == 0 || missingKeys.length > 0) {
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

        const maybeTypedResult = getTypedValueFromList<AuthType>(
            {
                allowedValues: Object.values(AuthType),
                allStringValues: validStringScalars,
                keyName: CommonAuthMapProperties.type,
            },
            errors,
        );

        return { result: maybeTypedResult?.value, errors };
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

/**
 * Parses an auth map that only consists of scalar values (some of which may be restricted to a fixed set of values).
 * The names of the parsed properties are the same as the Yaml keys.
 */
function parseFlatAuthMap<T extends ParsedYamlMap<{ type: unknown }>>(
    args: {
        authMap: YAMLMap;
        parsedType: WithKeyAndValueRange<AuthType>;
        stringKeys: string[];
        booleanKeys?: string[];
        numberKeys?: string[];
        enumKeys?: Record<string, string[]>;
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
    const { items, getString, getBoolean, getNumber, missingProperties } =
        getValidatedMapItems(
            authMap,
            {
                scalars: {
                    stringValues: stringKeys,
                    booleanValues: booleanKeys,
                    numericValues: numberKeys,
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
    for (const [key, allowedValues] of Object.entries(enumKeys)) {
        properties[key] = getTypedValueFromList<string>(
            {
                allowedValues,
                allStringValues: items.validScalars.withStringValue,
                keyName: key,
            },
            collectedErrors,
        )?.value;
    }

    return { properties, missingProperties } as unknown as T;
}
