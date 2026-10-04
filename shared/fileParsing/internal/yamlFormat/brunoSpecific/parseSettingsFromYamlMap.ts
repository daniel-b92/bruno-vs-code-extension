import { YAMLMap } from "yaml";
import {
    CommonParsingArgs,
    ParsedSettings,
    WithKeyAndKeyRange,
} from "../interfaces";
import { YamlParsingError } from "../../../..";
import {
    RequestFileSettingsProperty,
    WEBSOCKET_SETTINGS_PROPERTIES,
} from "../../../external/yamlFormat/constants/requestFileConstants";
import { FileInfoType } from "../../../external/yamlFormat/constants/sharedConstants";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import { getRangeForItem } from "../util/getRangeForItem";
import { stripKeyFromResult } from "../util/stripKeyFromResult";

export function parseSettingsFromYamlMap(
    { keyRange, value: settingsMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    requestType?: FileInfoType,
): {
    result: ParsedSettings;
    errors: YamlParsingError[];
} {
    const errors: YamlParsingError[] = [];
    // Websocket requests only support a subset of the settings and the keep alive interval is exclusive to them.
    // If the request type is unknown, no setting is excluded.
    const isAllowed = (property: RequestFileSettingsProperty) => {
        if (requestType == undefined) {
            return true;
        }
        return requestType == FileInfoType.Websocket
            ? WEBSOCKET_SETTINGS_PROPERTIES.includes(property)
            : property != RequestFileSettingsProperty.KeepAliveInterval;
    };
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
                    ].filter(isAllowed),
                    // timeout can either be a number or the string 'inherit'.
                    numericValues: [
                        RequestFileSettingsProperty.MaxRedirects,
                        RequestFileSettingsProperty.Timeout,
                        RequestFileSettingsProperty.KeepAliveInterval,
                    ].filter(isAllowed),
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
                keepAliveInterval: stripKeyFromResult(
                    getNumber(RequestFileSettingsProperty.KeepAliveInterval),
                ),
            },
            missingProperties,
        },
        errors,
    };
}
