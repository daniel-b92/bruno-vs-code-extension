import {
    BrunoFileType,
    ParsedAppFile,
    ParsedInfoForFolderSettings,
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
import { stripKeyFromResult } from "../../internal/yamlFormat/util/stripKeyFromResult";
import { parseIfPresent } from "../../internal/yamlFormat/util/parseIfPresent";
import { TopLevelAppFileProperty } from "./constants/appFileConstants";

export function parseAppFile(
    docHelper: TextDocumentHelper,
): MaybeResultWithErrors<ParsedAppFile> {
    const commonArgs: CommonParsingArgs = {
        docHelper,
        fullDocumentRange: docHelper.getTextRange(),
    };
    const collectedErrors: YamlParsingError[] = [];

    const maybeTopLevelMap = parseDocumentIntoYamlMap(commonArgs);
    if ("errors" in maybeTopLevelMap) {
        return maybeTopLevelMap;
    }

    const { getString, getMap, missingProperties } = getValidatedMapItems(
        maybeTopLevelMap.map,
        {
            // Code is always a scalar for app files.
            scalars: { stringValues: [TopLevelAppFileProperty.Code] },
            mapValues: [TopLevelAppFileProperty.Info],
            mandatoryKeys: [TopLevelAppFileProperty.Info],
        },
        commonArgs,
        collectedErrors,
    );

    const info: ParsedInfoForFolderSettings | undefined = parseIfPresent(
        getMap(TopLevelAppFileProperty.Info),
        (infoMap) =>
            parseFileInfoFromYamlMap({
                infoMap,
                commonArgs,
                fileType: BrunoFileType.AppFile,
            }),
        collectedErrors,
    );
    const code = stripKeyFromResult(getString(TopLevelAppFileProperty.Code));

    return {
        errors: collectedErrors,
        result: { properties: { info, code }, missingProperties },
    };
}
