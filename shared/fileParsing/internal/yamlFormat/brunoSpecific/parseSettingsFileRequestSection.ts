import { YAMLMap } from "yaml";
import { YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedSettingsFileRequestSection,
    WithKeyAndKeyRange,
} from "../interfaces";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { parseIfPresent } from "../util/parseIfPresent";
import { getRangeForItem } from "../util/getRangeForItem";
import { parseHeadersFromSequence } from "./parseHeadersFromSequence";
import { parseAuthFromYamlMapOrScalar } from "./parseAuthFromYamlMapOrScalar";
import { parseVariablesFromYamlSequence } from "./parseVariablesFromYamlSequence";
import { parseScriptsFromYamlSequence } from "./parseScriptsFromYamlSequence";
import { parseActionsFromYamlSequence } from "./parseActionsFromYamlSequence";
import { SettingsFileRequestSectionProperty } from "../../../external/yamlFormat/constants/sharedConstants";

/**
 * Parses the `request` section, which has the same structure for folder settings files and collection settings files.
 */
export function parseSettingsFileRequestSection(
    { keyRange, value: requestMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedSettingsFileRequestSection> {
    const collectedErrors: YamlParsingError[] = [];
    const { getString, getMap, getSequence, missingProperties } =
        getValidatedMapItems(
            requestMap,
            {
                // Auth can either be a Scalar string with the value 'inherit' or a map with a specific type.
                scalars: {
                    stringValues: [SettingsFileRequestSectionProperty.Auth],
                },
                mapValues: [SettingsFileRequestSectionProperty.Auth],
                sequenceValues: [
                    SettingsFileRequestSectionProperty.Headers,
                    SettingsFileRequestSectionProperty.Variables,
                    SettingsFileRequestSectionProperty.Scripts,
                    SettingsFileRequestSectionProperty.Actions,
                ],
                // None of the properties are mandatory.
            },
            commonArgs,
            collectedErrors,
        );

    return {
        errors: collectedErrors,
        result: {
            keyRange,
            valueRange: getRangeForItem(requestMap, commonArgs),
            missingProperties,
            properties: {
                headers: parseIfPresent(
                    getSequence(SettingsFileRequestSectionProperty.Headers),
                    ({ value: headersSequence }) =>
                        parseHeadersFromSequence({
                            commonArgs,
                            headersSequence,
                        }),
                    collectedErrors,
                ),
                auth: parseIfPresent(
                    getString(SettingsFileRequestSectionProperty.Auth) ??
                        getMap(SettingsFileRequestSectionProperty.Auth),
                    (authMapOrScalar) =>
                        parseAuthFromYamlMapOrScalar({
                            commonArgs,
                            authMapOrScalar,
                        }),
                    collectedErrors,
                ),
                variables: parseIfPresent(
                    getSequence(SettingsFileRequestSectionProperty.Variables),
                    ({ value }) =>
                        parseVariablesFromYamlSequence(value, commonArgs),
                    collectedErrors,
                ),
                scripts: parseIfPresent(
                    getSequence(SettingsFileRequestSectionProperty.Scripts),
                    ({ value }) =>
                        parseScriptsFromYamlSequence(value, commonArgs),
                    collectedErrors,
                ),
                actions: parseIfPresent(
                    getSequence(SettingsFileRequestSectionProperty.Actions),
                    ({ value }) =>
                        parseActionsFromYamlSequence(value, commonArgs),
                    collectedErrors,
                ),
            },
        },
    };
}
