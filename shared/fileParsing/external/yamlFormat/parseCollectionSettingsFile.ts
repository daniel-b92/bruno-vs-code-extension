import {
    BrunoFileType,
    ParsedCollectionSettingsFile,
    TextDocumentHelper,
    YamlParsingError,
} from "../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
} from "../../internal/yamlFormat/interfaces";
import { getValidatedMapItems } from "../../internal/yamlFormat/yamlMaps/getValidatedMapItems";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { parseFileInfoFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseFileInfoFromYamlMap";
import { parseSettingsFileRequestSection } from "../../internal/yamlFormat/brunoSpecific/parseSettingsFileRequestSection";
import { parseCollectionConfigFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseCollectionConfigFromYamlMap";
import { parseExtensionsFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseBrunoExtensionsFromYamlMap";
import { parseDocsFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseDocsFromYamlMap";
import { parseIfPresent } from "../../internal/yamlFormat/util/parseIfPresent";
import { stripKeyFromResult } from "../../internal/yamlFormat/util/stripKeyFromResult";
import { TopLevelCollectionSettingsProperty } from "./constants/collectionSettingsFileConstants";

export function parseCollectionSettingsFile(
    docHelper: TextDocumentHelper,
): MaybeResultWithErrors<ParsedCollectionSettingsFile> {
    const commonArgs: CommonParsingArgs = {
        docHelper,
        fullDocumentRange: docHelper.getTextRange(),
    };
    const collectedErrors: YamlParsingError[] = [];

    const maybeTopLevelMap = parseDocumentIntoYamlMap(commonArgs);
    if ("errors" in maybeTopLevelMap) {
        return maybeTopLevelMap;
    }

    const { getString, getBoolean, getMap, missingProperties } =
        getValidatedMapItems(
            maybeTopLevelMap.map,
            {
                scalars: {
                    stringValues: [
                        TopLevelCollectionSettingsProperty.OpenCollection,
                    ],
                    booleanValues: [TopLevelCollectionSettingsProperty.Bundled],
                },
                mapValues: [
                    TopLevelCollectionSettingsProperty.Info,
                    TopLevelCollectionSettingsProperty.Config,
                    TopLevelCollectionSettingsProperty.Request,
                    TopLevelCollectionSettingsProperty.Docs,
                    TopLevelCollectionSettingsProperty.Extensions,
                ],
                mandatoryKeys: [
                    TopLevelCollectionSettingsProperty.OpenCollection,
                    TopLevelCollectionSettingsProperty.Info,
                ],
            },
            commonArgs,
            collectedErrors,
        );

    const requestMap = getMap(TopLevelCollectionSettingsProperty.Request);

    return {
        errors: collectedErrors,
        result: {
            properties: {
                opencollection: stripKeyFromResult(
                    getString(
                        TopLevelCollectionSettingsProperty.OpenCollection,
                    ),
                ),
                info: parseIfPresent(
                    getMap(TopLevelCollectionSettingsProperty.Info),
                    (infoMap) =>
                        parseFileInfoFromYamlMap({
                            infoMap,
                            commonArgs,
                            fileType: BrunoFileType.CollectionSettingsFile,
                        }),
                    collectedErrors,
                ),
                config: parseIfPresent(
                    getMap(TopLevelCollectionSettingsProperty.Config),
                    (configMap) =>
                        parseCollectionConfigFromYamlMap(configMap, commonArgs),
                    collectedErrors,
                ),
                request: requestMap
                    ? parseSettingsFileRequestSection(
                          requestMap,
                          commonArgs,
                          collectedErrors,
                      )
                    : undefined,
                docs: parseIfPresent(
                    getMap(TopLevelCollectionSettingsProperty.Docs),
                    (docsMap) => parseDocsFromYamlMap(docsMap, commonArgs),
                    collectedErrors,
                ),
                bundled: stripKeyFromResult(
                    getBoolean(TopLevelCollectionSettingsProperty.Bundled),
                ),
                extensions: parseIfPresent(
                    getMap(TopLevelCollectionSettingsProperty.Extensions),
                    (extensionsMap) =>
                        parseExtensionsFromYamlMap(extensionsMap, commonArgs),
                    collectedErrors,
                ),
            },
            missingProperties,
        },
    };
}
