import {
    BrunoFileType,
    ParsedFolderSettingsFile,
    TextDocumentHelper,
    YamlParsingError,
} from "../../..";
import {
    CommonParsingArgs,
    TopLevelFolderSettingsProperty,
} from "../../internal/yamlFormat/interfaces";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { getErrorForUnknownKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForUnknownKeyInMap";
import { parseFileInfoFromYamlMap } from "../../internal/yamlFormat/yamlMaps/parseFileInfoFromYamlMap";

type Result =
    | YamlParsingError[]
    | {
          result: ParsedFolderSettingsFile;
          errors: YamlParsingError[];
      };

export function parseFolderSettingsFile(docHelper: TextDocumentHelper) {
    const commonArgs: CommonParsingArgs = {
        docHelper,
        fullDocumentRange: docHelper.getTextRange(),
    };
    const collectedErrors: YamlParsingError[] = [];
    const expectedTopLevelProperties = Object.values(
        TopLevelFolderSettingsProperty,
    );

    const maybeTopLevelMap = parseDocumentIntoYamlMap(commonArgs);
    if ("errors" in maybeTopLevelMap) {
        return maybeTopLevelMap.errors;
    }

    const { map: topLevelMap } = maybeTopLevelMap;
    const {
        items: { missingKeys, unknownKeys, validMaps },
        errors: mapItemErrors,
    } = getMapItems(
        topLevelMap,
        {
            scalars: {},
            mapValues: expectedTopLevelProperties,
        },
        commonArgs,
    );

    collectedErrors.push(
        ...mapItemErrors.concat(
            unknownKeys.map(({ key: unknownKey, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonArgs,
                    unknownKey,
                    keyRange,
                    allowedKeys: expectedTopLevelProperties,
                }),
            ),
        ),
    );
    if (missingKeys.includes(TopLevelFolderSettingsProperty.Info)) {
        return collectedErrors.concat(
            getErrorForMissingKeyInMap({
                ...commonArgs,
                missingKey: TopLevelFolderSettingsProperty.Info,
                map: topLevelMap,
            }),
        );
    }
    const infoMap = validMaps.find(
        ({ key }) => key == TopLevelFolderSettingsProperty.Info,
    )!;
    const infoResult = parseFileInfoFromYamlMap(
        { infoMap, commonArgs, fileType: BrunoFileType.FolderSettingsFile },
        collectedErrors,
    );
}
