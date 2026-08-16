import { isMap, YAMLMap } from "yaml";
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
    ParsingResult,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { getMapItems } from "../yamlMaps/getMapItems";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import { isParsingResultOnlyErrors } from "../util/isParsingResultOnlyErrors";
import {
    AuthType,
    BasicAuthProperty,
    BearerAuthProperty,
    CommonAuthMapProperties,
    inheritAuthValue,
} from "./constants/authConstants";

type ParsedAuthResult = ParsingResult<ParsedAuth>;

export function parseAuthFromYamlMapOrScalar(args: {
    commonArgs: CommonParsingArgs;
    authMapOrScalar: YAMLMap | WithKeyKeyRangeAndValueRange<string>;
}): ParsedAuthResult {
    const { commonArgs, authMapOrScalar } = args;
    const allErrors: YamlParsingError[] = [];

    if (!isMap(authMapOrScalar)) {
        const { valueRange } = authMapOrScalar;
        return authMapOrScalar.value == inheritAuthValue
            ? { result: { valueRange }, errors: [] }
            : [
                  {
                      message: `Invalid Scalar string for auth. Allowed is only '${inheritAuthValue}'.`,
                      range: valueRange,
                      code: YamlParsingErrorCode.Other,
                  },
              ];
    }

    const maybeAuthType = tryToParseAuthTypeField(authMapOrScalar, commonArgs);
    if (isParsingResultOnlyErrors(maybeAuthType)) {
        return maybeAuthType;
    }

    const { errors: typeParsingErrors, result: authType } = maybeAuthType;
    allErrors.push(...typeParsingErrors);

    switch (authType.value) {
        case AuthType.Basic:
            const { auth: basicAuthResult, errors: basicAuthErrors } =
                parseBasicAuthFromAuthMap(
                    {
                        authMap: authMapOrScalar,
                        parsedType:
                            authType as WithKeyAndValueRange<AuthType.Basic>,
                    },
                    commonArgs,
                );
            return {
                result: basicAuthResult,
                errors: allErrors.concat(basicAuthErrors),
            };
        case AuthType.Bearer:
            const { auth: bearerAuthResult, errors: bearerAuthErrors } =
                parseBearerAuthFromAuthMap(
                    {
                        authMap: authMapOrScalar,
                        parsedType:
                            authType as WithKeyAndValueRange<AuthType.Bearer>,
                    },
                    commonArgs,
                );
            return {
                result: bearerAuthResult,
                errors: allErrors.concat(bearerAuthErrors),
            };
        // ToDo: Add support for more auth types.
        default:
            return allErrors;
    }

    function tryToParseAuthTypeField(
        authMap: YAMLMap,
        commonParsingArgs: CommonParsingArgs,
    ): ParsingResult<WithKeyAndValueRange<AuthType>> {
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
            return errors.concat(
                missingKeys.map((key) =>
                    getErrorForMissingKeyInMap({
                        ...commonParsingArgs,
                        map: authMap,
                        missingKey: key,
                    }),
                ),
            );
        }

        const maybeTypedResult = getTypedValueFromList<AuthType>(
            {
                allowedValues: Object.values(AuthType),
                allStringValues: validStringScalars,
                keyName: CommonAuthMapProperties.type,
            },
            errors,
        );

        return !maybeTypedResult
            ? errors
            : { result: maybeTypedResult.value, errors };
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

        const {
            errors,
            items: {
                unknownKeys,
                validScalars: { withStringValue: validStringScalars },
            },
        } = getMapItems(
            authMap,
            { scalars: { stringValues: expectedStringScalars } },
            commonParsingArgs,
        );

        const allErrors = errors.concat(
            unknownKeys.map(({ key, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonParsingArgs,
                    allowedKeys: expectedStringScalars,
                    keyRange,
                    unknownKey: key,
                }),
            ),
        );

        const username = validStringScalars.find(
            ({ key }) => key == BasicAuthProperty.Username,
        );
        const password = validStringScalars.find(
            ({ key }) => key == BasicAuthProperty.Password,
        );
        return {
            auth: {
                type,
                username: username ? stripKeyFromResult(username) : undefined,
                password: password ? stripKeyFromResult(password) : undefined,
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

        const {
            errors,
            items: {
                unknownKeys,
                validScalars: { withStringValue: validStringScalars },
            },
        } = getMapItems(
            authMap,
            { scalars: { stringValues: expectedStringScalars } },
            commonParsingArgs,
        );

        const allErrors = errors.concat(
            unknownKeys.map(({ key, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonParsingArgs,
                    allowedKeys: expectedStringScalars,
                    keyRange,
                    unknownKey: key,
                }),
            ),
        );

        const token = validStringScalars.find(
            ({ key }) => key == BearerAuthProperty.Token,
        );
        return {
            auth: {
                type,
                token: token ? stripKeyFromResult(token) : undefined,
            },
            errors: allErrors,
        };
    }
}
