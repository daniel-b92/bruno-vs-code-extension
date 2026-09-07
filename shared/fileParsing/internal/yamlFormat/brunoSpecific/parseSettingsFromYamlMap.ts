import { YAMLMap } from "yaml";
import {
    CommonParsingArgs,
    ParsedSettings,
    WithKeyAndKeyRange,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { YamlMapMissingPropertyInfo, YamlParsingError } from "../../../..";
import { RequestFileSettingsProperty } from "../../../external/yamlFormat/constants/requestFileConstants";
import { getMapItems } from "../yamlMaps/getMapItems";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import { getRangeForItem } from "../util/getRangeForItem";
import { stripKeyFromResult } from "../util/stripKeyFromResult";

export function parseSettingsFromYamlMap(
    settingsMap: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): {
    result: ParsedSettings;
    errors: YamlParsingError[];
} {
    const {
        errors,
        missingProperties,
        validScalars: {
            withBooleanValue: validBooleanScalars,
            withNumericValue: validNumericScalars,
            withStringValue: validStringScalars,
        },
    } = getParsedMapItems(settingsMap.value, commonArgs);

    return mapMapItemsToSettings(settingsMap, commonArgs, {
        errors,
        missingProperties,
        validBooleanScalars,
        validNumericScalars,
        validStringScalars,
    });
}

function getParsedMapItems(map: YAMLMap, commonArgs: CommonParsingArgs) {
    const expectedBooleanScalars = [
        RequestFileSettingsProperty.EncodeUrl,
        RequestFileSettingsProperty.FollowRedirects,
        RequestFileSettingsProperty.ForwardAuthorizationHeader,
    ];
    const expectedNumericScalars = [
        RequestFileSettingsProperty.MaxRedirects,
        RequestFileSettingsProperty.Timeout,
    ];
    // timeout can either be a number or the string 'inherit'.
    const expectedStringScalars = [RequestFileSettingsProperty.Timeout];

    const {
        errors: mapItemErrors,
        items: { unknownKeys, missingKeys, validScalars },
    } = getMapItems(
        map,
        {
            scalars: {
                stringValues: expectedStringScalars,
                booleanValues: expectedBooleanScalars,
                numericValues: expectedNumericScalars,
            },
        },
        commonArgs,
    );

    const errors = mapItemErrors.concat(
        unknownKeys.map(
            ({ key, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonArgs,
                    allowedKeys: Object.values(RequestFileSettingsProperty),
                    keyRange,
                    unknownKey: key,
                }),
            missingKeys.map((key) =>
                getErrorForMissingKeyInMap({
                    ...commonArgs,
                    map: map,
                    missingKey: key,
                }),
            ),
        ),
    );
    // timeout property was searched for as both a numeric and string scalar. So only, if it is not found for both, it is really missing.
    const isTimeoutPropertyMissing =
        missingKeys.filter((key) => key == RequestFileSettingsProperty.Timeout)
            .length > 1;
    const missingProperties = missingKeys
        .filter((key) => key != RequestFileSettingsProperty.Timeout)
        .concat(
            isTimeoutPropertyMissing ? RequestFileSettingsProperty.Timeout : [],
        )
        .map((key) => ({
            key,
            alwaysHasScalarValue: true,
            isMandatory: true,
        }));

    return { validScalars, errors, missingProperties };
}
function mapMapItemsToSettings(
    settingsMap: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    parsingResults: {
        validBooleanScalars: WithKeyKeyRangeAndValueRange<boolean>[];
        validNumericScalars: WithKeyKeyRangeAndValueRange<number>[];
        validStringScalars: WithKeyKeyRangeAndValueRange<string>[];
        missingProperties: YamlMapMissingPropertyInfo[];
        errors: YamlParsingError[];
    },
) {
    const {
        validBooleanScalars,
        validNumericScalars,
        validStringScalars,
        errors,
        missingProperties,
    } = parsingResults;
    const encodeUrl = validBooleanScalars.find(
        ({ key }) => key == RequestFileSettingsProperty.EncodeUrl,
    );
    const followRedirects = validBooleanScalars.find(
        ({ key }) => key == RequestFileSettingsProperty.FollowRedirects,
    );
    const forwardAuthorizationHeader = validBooleanScalars.find(
        ({ key }) =>
            key == RequestFileSettingsProperty.ForwardAuthorizationHeader,
    );
    const maxRedirects = validNumericScalars.find(
        ({ key }) => key == RequestFileSettingsProperty.MaxRedirects,
    );
    const timeoutAsString = validStringScalars.find(
        ({ key }) => key == RequestFileSettingsProperty.Timeout,
    );
    const timeout = timeoutAsString
        ? getTypedValueFromList(
              {
                  allowedValues: ["inherit"],
                  allStringValues: [timeoutAsString],
                  keyName: RequestFileSettingsProperty.Timeout,
              },
              errors,
          )?.value
        : validNumericScalars.find(
              ({ key }) => key == RequestFileSettingsProperty.Timeout,
          );

    return {
        result: {
            keyRange: settingsMap.keyRange,
            valueRange: getRangeForItem(settingsMap.value, commonArgs),
            properties: {
                encodeUrl: encodeUrl
                    ? stripKeyFromResult(encodeUrl)
                    : undefined,
                followRedirects: followRedirects
                    ? stripKeyFromResult(followRedirects)
                    : undefined,
                forwardAuthorizationHeader: forwardAuthorizationHeader
                    ? stripKeyFromResult(forwardAuthorizationHeader)
                    : undefined,
                maxRedirects: maxRedirects
                    ? stripKeyFromResult(maxRedirects)
                    : undefined,
                timeout:
                    timeout && "key" in timeout
                        ? stripKeyFromResult(timeout)
                        : timeout,
            },
            missingProperties,
        },
        errors,
    };
}
