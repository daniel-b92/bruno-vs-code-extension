import { BrunoFileType, TextDocumentHelper, YamlParsingError } from "../../..";
import {
    CommonParsingArgs,
    TopLevelRequestFileProperty,
} from "../../internal/yamlFormat/interfaces";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import {
    ParsedInfoResult,
    parseFileInfoFromYamlMap,
} from "../../internal/yamlFormat/brunoSpecific/parseFileInfoFromYamlMap";
import { isParsingResultOnlyErrors } from "../../internal/yamlFormat/util/isParsingResultOnlyErrors";

export function parseInfoFromYamlFile(
    docHelper: TextDocumentHelper,
    fileType: BrunoFileType,
): ParsedInfoResult {
    const commonArgs: CommonParsingArgs = {
        docHelper,
        fullDocumentRange: docHelper.getTextRange(),
    };
    const collectedErrors: YamlParsingError[] = [];
    const infoKey = TopLevelRequestFileProperty.Info;

    const maybeTopLevelMap = parseDocumentIntoYamlMap(commonArgs);
    if ("errors" in maybeTopLevelMap) {
        return maybeTopLevelMap.errors;
    }

    const { map: topLevelMap } = maybeTopLevelMap;
    const {
        items: { missingKeys, validMaps },
        errors: mapItemErrors,
    } = getMapItems(
        topLevelMap,
        {
            scalars: {},
            mapValues: [infoKey],
        },
        commonArgs,
    );

    collectedErrors.push(...mapItemErrors);
    if (missingKeys.length > 0 || validMaps.length == 0) {
        return collectedErrors.concat(
            getErrorForMissingKeyInMap({
                ...commonArgs,
                missingKey: infoKey,
                map: topLevelMap,
            }),
        );
    }
    const infoMap = validMaps[0];
    const maybeResult = parseFileInfoFromYamlMap({
        infoMap,
        commonArgs,
        fileType,
    });

    return isParsingResultOnlyErrors(maybeResult)
        ? collectedErrors.concat(maybeResult)
        : {
              ...maybeResult,
              errors: collectedErrors.concat(maybeResult.errors),
          };
}
