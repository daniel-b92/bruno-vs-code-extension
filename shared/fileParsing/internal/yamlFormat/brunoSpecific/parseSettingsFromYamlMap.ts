import { YAMLMap } from "yaml";
import {
    CommonParsingArgs,
    ParsedSettings,
    WithKeyAndKeyRange,
} from "../interfaces";
import { YamlParsingError } from "../../../..";
import { RequestFileSettingsProperty } from "../../../external/yamlFormat/constants/requestFileConstants";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import { getRangeForItem } from "../util/getRangeForItem";
import { stripKeyFromResult } from "../util/stripKeyFromResult";

export function parseSettingsFromYamlMap(
    { keyRange, value: settingsMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): {
    result: ParsedSettings;
    errors: YamlParsingError[];
} {
    const errors: YamlParsingError[] = [];
    const { getString, getBoolean, getNumber, missingProperties } =
        getValidatedMapItems(
            settingsMap,
            {
                scalars: {
                    stringValues: [RequestFileSettingsProperty.Timeout],
                    booleanValues: [
                        RequestFileSettingsProperty.EncodeUrl,
                        RequestFileSettingsProperty.FollowRedirects,
                        RequestFileSettingsProperty.ForwardAuthorizationHeader,
                    ],
                    // timeout can either be a number or the string 'inherit'.
                    numericValues: [
                        RequestFileSettingsProperty.MaxRedirects,
                        RequestFileSettingsProperty.Timeout,
                    ],
                },
                // All properties are optional (e.g. older files lack newer settings).
            },
            commonArgs,
            errors,
        );

    const timeoutAsString = getString(RequestFileSettingsProperty.Timeout);
    const timeout = timeoutAsString
        ? getTypedValueFromList(
              {
                  allowedValues: ["inherit"],
                  allStringValues: [timeoutAsString],
                  keyName: RequestFileSettingsProperty.Timeout,
              },
              errors,
          )?.value
        : stripKeyFromResult(getNumber(RequestFileSettingsProperty.Timeout));

    return {
        result: {
            keyRange,
            valueRange: getRangeForItem(settingsMap, commonArgs),
            properties: {
                encodeUrl: stripKeyFromResult(
                    getBoolean(RequestFileSettingsProperty.EncodeUrl),
                ),
                followRedirects: stripKeyFromResult(
                    getBoolean(RequestFileSettingsProperty.FollowRedirects),
                ),
                forwardAuthorizationHeader: stripKeyFromResult(
                    getBoolean(
                        RequestFileSettingsProperty.ForwardAuthorizationHeader,
                    ),
                ),
                maxRedirects: stripKeyFromResult(
                    getNumber(RequestFileSettingsProperty.MaxRedirects),
                ),
                timeout,
            },
            missingProperties,
        },
        errors,
    };
}
