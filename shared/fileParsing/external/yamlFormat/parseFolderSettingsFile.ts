import {
    BrunoFileType,
    ParsedFolderSettingsFile,
    ParsedInfoForFolderSettings,
    TextDocumentHelper,
    YamlParsingError,
} from "../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedDocsWithType,
} from "../../internal/yamlFormat/interfaces";
import { getValidatedMapItems } from "../../internal/yamlFormat/yamlMaps/getValidatedMapItems";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { parseFileInfoFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseFileInfoFromYamlMap";
import { TopLevelFolderSettingsProperty } from "./constants/folderSettingsFileConstants";
import { parseSettingsFileRequestSection } from "../../internal/yamlFormat/brunoSpecific/parseSettingsFileRequestSection";
import { parseDocsFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseDocsFromYamlMap";
import { parseIfPresent } from "../../internal/yamlFormat/util/parseIfPresent";

export function parseFolderSettingsFile(
    docHelper: TextDocumentHelper,
): MaybeResultWithErrors<ParsedFolderSettingsFile> {
    const commonArgs: CommonParsingArgs = {
        docHelper,
        fullDocumentRange: docHelper.getTextRange(),
    };
    const collectedErrors: YamlParsingError[] = [];

    const maybeTopLevelMap = parseDocumentIntoYamlMap(commonArgs);
    if ("errors" in maybeTopLevelMap) {
        return maybeTopLevelMap;
    }

    const { getMap, missingProperties } = getValidatedMapItems(
        maybeTopLevelMap.map,
        {
            // Docs section is always a Yaml map for folder settings files.
            mapValues: Object.values(TopLevelFolderSettingsProperty),
            mandatoryKeys: [TopLevelFolderSettingsProperty.Info],
        },
        commonArgs,
        collectedErrors,
    );

    const requestMap = getMap(TopLevelFolderSettingsProperty.Request);
    const info: ParsedInfoForFolderSettings | undefined = parseIfPresent(
        getMap(TopLevelFolderSettingsProperty.Info),
        (infoMap) =>
            parseFileInfoFromYamlMap({
                infoMap,
                commonArgs,
                fileType: BrunoFileType.FolderSettingsFile,
            }),
        collectedErrors,
    );
    const request = requestMap
        ? parseSettingsFileRequestSection(
              requestMap,
              commonArgs,
              collectedErrors,
          )
        : undefined;
    const docs: ParsedDocsWithType | undefined = parseIfPresent(
        getMap(TopLevelFolderSettingsProperty.Docs),
        (docsMap) => parseDocsFromYamlMap(docsMap, commonArgs),
        collectedErrors,
    );

    return {
        errors: collectedErrors,
        result: { properties: { info, request, docs }, missingProperties },
    };
}
