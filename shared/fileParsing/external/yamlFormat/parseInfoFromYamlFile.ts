import { BrunoFileType, TextDocumentHelper, YamlParsingError } from "../../..";
import { CommonParsingArgs } from "../../internal/yamlFormat/interfaces";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import {
    ParsedInfoResult,
    parseFileInfoFromYamlMap,
} from "../../internal/yamlFormat/brunoSpecific/parseFileInfoFromYamlMap";
import { TopLevelRequestFileProperty } from "./constants/requestFileConstants";

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
        return maybeTopLevelMap;
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

    collectedErrors.push(
        ...mapItemErrors.concat(
            missingKeys.length > 0
                ? getErrorForMissingKeyInMap({
                      ...commonArgs,
                      missingKey: infoKey,
                      map: topLevelMap,
                  })
                : [],
        ),
    );
    if (validMaps.length == 0) {
        return { errors: collectedErrors };
    }

    const infoMap = validMaps[0];
    const maybeResult = parseFileInfoFromYamlMap({
        infoMap,
        commonArgs,
        fileType,
    });

    return maybeResult;
}
