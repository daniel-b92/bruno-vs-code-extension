import {
    BrunoFileType,
    ParsedFolderSettingsFile,
    TextDocumentHelper,
    YamlParsingError,
} from "../../..";
import {
    CommonParsingArgs,
    ParsingResult,
    TopLevelFolderSettingsProperty,
    WithKeyAndKeyRange,
} from "../../internal/yamlFormat/interfaces";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { getErrorForUnknownKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForUnknownKeyInMap";
import { parseFileInfoFromYamlMap } from "../../internal/yamlFormat/yamlMaps/parseFileInfoFromYamlMap";
import { YAMLMap } from "yaml";
import { isParsingResultOnlyErrors } from "../../internal/yamlFormat/util/isParsingResultOnlyErrors";

type Result = ParsingResult<ParsedFolderSettingsFile>;

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
        // The info property is the only mandatory one.
        return collectedErrors.concat(
            getErrorForMissingKeyInMap({
                ...commonArgs,
                missingKey: TopLevelFolderSettingsProperty.Info,
                map: topLevelMap,
            }),
        );
    }
    const info = getParsedInfo(validMaps, commonArgs, collectedErrors);
}

function getParsedInfo(
    validSecondLevelMaps: WithKeyAndKeyRange<YAMLMap<unknown, unknown>>[],
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
) {
    const infoMap = validSecondLevelMaps.find(
        ({ key }) => key == TopLevelFolderSettingsProperty.Info,
    );

    if (!infoMap) {
        return undefined;
    }
    const infoResult = parseFileInfoFromYamlMap({
        infoMap,
        commonArgs,
        fileType: BrunoFileType.FolderSettingsFile,
    });
    const { info, errors: infoErrors } = isParsingResultOnlyErrors(infoResult)
        ? { info: undefined, errors: infoResult }
        : { info: infoResult.result, errors: infoResult.errors };
    collectedErrors.push(...infoErrors);

    return info;
}
