import { YAMLMap } from "yaml";
import {
    CommonParsingArgs,
    ParsedSettings,
    WithKeyAndKeyRange,
} from "../interfaces";
import { YamlParsingError } from "../../../..";
import {
    RequestFileSettingsProperty,
    SETTINGS_BY_REQUEST_TYPE,
} from "../../../external/yamlFormat/constants/requestFileConstants";
import { FileInfoType } from "../../../external/yamlFormat/constants/sharedConstants";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
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
    const allowedSettings =
        requestType && SETTINGS_BY_REQUEST_TYPE[requestType];
    const isAllowed = (property: RequestFileSettingsProperty) =>
        allowedSettings?.includes(property) ?? true;
    const { getEnumValue, getBoolean, getNumber } = getValidatedMapItems(
        settingsMap,
        {
            scalars: {
                // timeout can either be a number or the string 'inherit'.
                enumValues: {
                    [RequestFileSettingsProperty.Timeout]: ["inherit"],
                },
                booleanValues: [
                    RequestFileSettingsProperty.EncodeUrl,
                    RequestFileSettingsProperty.FollowRedirects,
                    RequestFileSettingsProperty.ForwardAuthorizationHeader,
                ].filter(isAllowed),
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

    const timeout =
        getEnumValue<"inherit">(RequestFileSettingsProperty.Timeout) ??
        stripKeyFromResult(getNumber(RequestFileSettingsProperty.Timeout));

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
        },
        errors,
    };
}
