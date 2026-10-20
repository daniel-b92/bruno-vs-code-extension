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
import { inheritAuthValue } from "../../../external/yamlFormat/constants/authConstants";

/**
 * Parses the `request` section, which has the same structure for folder settings files and collection settings files.
 *
 * @param canInheritAuth Whether the auth can be inherited from a parent.
 * If not, an inherited auth is still parsed (so that it can be reported by a dedicated check), but it is not suggested.
 */
export function parseSettingsFileRequestSection(
    { keyRange, value: requestMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    { canInheritAuth }: { canInheritAuth: boolean },
): MaybeResultWithErrors<ParsedSettingsFileRequestSection> {
    const collectedErrors: YamlParsingError[] = [];
    // Auth can either be a Scalar string with the value 'inherit' or a map with a specific type.
    const inheritableAuthValues = {
        [SettingsFileRequestSectionProperty.Auth]: [inheritAuthValue],
    };
    const { getMap, getSequence, getEnumValue } = getValidatedMapItems(
        requestMap,
        {
            scalars: {
                enumValues: canInheritAuth ? inheritableAuthValues : {},
            },
            hiddenEnumValues: canInheritAuth ? {} : inheritableAuthValues,
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
                    getEnumValue<typeof inheritAuthValue>(
                        SettingsFileRequestSectionProperty.Auth,
                    ) ?? getMap(SettingsFileRequestSectionProperty.Auth),
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
