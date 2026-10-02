import { YAMLMap } from "yaml";
import {
    WithKeyAndValueRange,
    YamlParsingError,
    YamlParsingErrorCode,
} from "../../../..";
import {
    CommonParsingArgs,
    ParsedAuth,
    ParsedBasicAuth,
    ParsedBearerAuth,
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
    AuthType,
    BasicAuthProperty,
    BearerAuthProperty,
    CommonAuthMapProperties,
    inheritAuthValue,
} from "../../../external/yamlFormat/constants/authConstants";
import { getRangeForItem } from "../util/getRangeForItem";

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

    switch (authType.value) {
        case AuthType.Basic:
            const { auth: basicAuthResult, errors: basicAuthErrors } =
                parseBasicAuthFromAuthMap(
                    {
                        authMap: authFullValue,
                        parsedType:
                            authType as WithKeyAndValueRange<AuthType.Basic>,
                    },
                    commonArgs,
                );
            return {
                result: {
                    keyRange,
                    value: basicAuthResult,
                    valueRange,
                },
                errors: allErrors.concat(basicAuthErrors),
            };
        case AuthType.Bearer:
            const { auth: bearerAuthResult, errors: bearerAuthErrors } =
                parseBearerAuthFromAuthMap(
                    {
                        authMap: authFullValue,
                        parsedType:
                            authType as WithKeyAndValueRange<AuthType.Bearer>,
                    },
                    commonArgs,
                );
            return {
                result: {
                    keyRange,
                    value: bearerAuthResult,
                    valueRange,
                },
                errors: allErrors.concat(bearerAuthErrors),
            };
        // ToDo: Add support for more auth types.
        default:
            return { errors: allErrors };
    }

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

    function parseBasicAuthFromAuthMap(
        args: {
            authMap: YAMLMap;
            parsedType: WithKeyAndValueRange<AuthType.Basic>;
        },
        commonParsingArgs: CommonParsingArgs,
    ): { auth: ParsedBasicAuth; errors: YamlParsingError[] } {
        const { authMap, parsedType: type } = args;
        const expectedStringScalars = Object.values(BasicAuthProperty);

        const allErrors: YamlParsingError[] = [];
        const { getString, missingProperties } = getValidatedMapItems(
            authMap,
            { scalars: { stringValues: expectedStringScalars } },
            commonParsingArgs,
            allErrors,
        );

        const username = getString(BasicAuthProperty.Username);
        const password = getString(BasicAuthProperty.Password);
        return {
            auth: {
                properties: {
                    type,
                    username: stripKeyFromResult(username),
                    password: stripKeyFromResult(password),
                },
                missingProperties,
            },
            errors: allErrors,
        };
    }

    function parseBearerAuthFromAuthMap(
        args: {
            authMap: YAMLMap;
            parsedType: WithKeyAndValueRange<AuthType.Bearer>;
        },
        commonParsingArgs: CommonParsingArgs,
    ): { auth: ParsedBearerAuth; errors: YamlParsingError[] } {
        const { authMap, parsedType: type } = args;
        const expectedStringScalars = Object.values(BearerAuthProperty);

        const allErrors: YamlParsingError[] = [];
        const { getString, missingProperties } = getValidatedMapItems(
            authMap,
            { scalars: { stringValues: expectedStringScalars } },
            commonParsingArgs,
            allErrors,
        );

        const token = getString(BearerAuthProperty.Token);
        return {
            auth: {
                properties: {
                    type,
                    token: stripKeyFromResult(token),
                },
                missingProperties,
            },
            errors: allErrors,
        };
    }
}
