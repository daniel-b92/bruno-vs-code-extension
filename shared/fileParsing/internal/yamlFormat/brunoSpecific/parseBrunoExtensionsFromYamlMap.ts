import { YAMLMap } from "yaml";
import { ParsedCollectionSettingsFile, YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    WithKeyAndKeyRange,
} from "../interfaces";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { getStringListFromSequence } from "../yamlSequences/getStringListFromSequence";
import { parseIfPresent } from "../util/parseIfPresent";
import { getRangeForItem } from "../util/getRangeForItem";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import {
    BrunoExtensionProperty,
    BrunoPresetsProperty,
    BrunoPresetsRequestProperty,
    BrunoPresetsRequestType,
    BrunoScriptsProperty,
    CollectionExtensionsProperty,
} from "../../../external/yamlFormat/constants/collectionSettingsFileConstants";

type ParsedExtensions = NonNullable<
    ParsedCollectionSettingsFile["properties"]["extensions"]
>;
type ParsedBrunoExtension = NonNullable<
    ParsedExtensions["properties"]["bruno"]
>;
type ParsedScripts = NonNullable<ParsedBrunoExtension["properties"]["scripts"]>;
type ParsedPresets = NonNullable<ParsedBrunoExtension["properties"]["presets"]>;

export function parseExtensionsFromYamlMap(
    { keyRange, value: extensionsMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedExtensions> {
    const errors: YamlParsingError[] = [];
    const { getMap } = getValidatedMapItems(
        extensionsMap,
        { mapValues: Object.values(CollectionExtensionsProperty) },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(extensionsMap, commonArgs),
            properties: {
                bruno: parseIfPresent(
                    getMap(CollectionExtensionsProperty.Bruno),
                    (brunoMap) => parseBrunoExtension(brunoMap, commonArgs),
                    errors,
                ),
            },
        },
    };
}

function parseBrunoExtension(
    { keyRange, value: brunoMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedBrunoExtension> {
    const errors: YamlParsingError[] = [];
    const { getMap, getSequence } = getValidatedMapItems(
        brunoMap,
        {
            sequenceValues: [BrunoExtensionProperty.Ignore],
            mapValues: [
                BrunoExtensionProperty.Presets,
                BrunoExtensionProperty.Scripts,
            ],
        },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(brunoMap, commonArgs),
            properties: {
                ignore: getStringListFromSequence(
                    getSequence(BrunoExtensionProperty.Ignore),
                    "Ignore",
                    commonArgs,
                    errors,
                ),
                presets: parseIfPresent(
                    getMap(BrunoExtensionProperty.Presets),
                    (presetsMap) => parsePresets(presetsMap, commonArgs),
                    errors,
                ),
                scripts: parseIfPresent(
                    getMap(BrunoExtensionProperty.Scripts),
                    (scriptsMap) => parseScripts(scriptsMap, commonArgs),
                    errors,
                ),
            },
        },
    };
}

function parseScripts(
    { keyRange, value: scriptsMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedScripts> {
    const errors: YamlParsingError[] = [];
    const { getSequence } = getValidatedMapItems(
        scriptsMap,
        { sequenceValues: [BrunoScriptsProperty.AdditionalContextRoots] },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(scriptsMap, commonArgs),
            properties: {
                additionalContextRoots: getStringListFromSequence(
                    getSequence(BrunoScriptsProperty.AdditionalContextRoots),
                    "AdditionalContextRoots",
                    commonArgs,
                    errors,
                ),
            },
        },
    };
}

function parsePresets(
    { keyRange, value: presetsMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedPresets> {
    const errors: YamlParsingError[] = [];
    const { getString, getMap } = getValidatedMapItems(
        presetsMap,
        {
            scalars: {
                stringValues: [BrunoPresetsProperty.DefaultEnvironment],
            },
            mapValues: [BrunoPresetsProperty.Request],
        },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(presetsMap, commonArgs),
            properties: {
                defaultEnvironment: stripKeyFromResult(
                    getString(BrunoPresetsProperty.DefaultEnvironment),
                ),
                request: parseIfPresent(
                    getMap(BrunoPresetsProperty.Request),
                    (requestMap) => parsePresetsRequest(requestMap, commonArgs),
                    errors,
                ),
            },
        },
    };
}

function parsePresetsRequest(
    { keyRange, value: requestMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<NonNullable<ParsedPresets["properties"]["request"]>> {
    const errors: YamlParsingError[] = [];
    const { getString, getEnumValue } = getValidatedMapItems(
        requestMap,
        {
            scalars: {
                stringValues: Object.values(BrunoPresetsRequestProperty),
                enumValues: {
                    [BrunoPresetsRequestProperty.Type]: Object.values(
                        BrunoPresetsRequestType,
                    ),
                },
            },
        },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(requestMap, commonArgs),
            properties: {
                type: getEnumValue<BrunoPresetsRequestType>(
                    BrunoPresetsRequestProperty.Type,
                ),
                url: stripKeyFromResult(
                    getString(BrunoPresetsRequestProperty.Url),
                ),
            },
        },
    };
}
