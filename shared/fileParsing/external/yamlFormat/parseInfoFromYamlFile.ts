import {
    BrunoFileType,
    ReasonForFieldAbsence,
    TextDocumentHelper,
    YamlParsingError,
} from "../../..";
import { CommonParsingArgs } from "../../internal/yamlFormat/interfaces";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { parseFileInfoFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseFileInfoFromYamlMap";
import { TopLevelRequestFileProperty } from "../../internal/yamlFormat/brunoSpecific/constants/requestFileConstants";

export function parseInfoFromYamlFile(
    docHelper: TextDocumentHelper,
    fileType: BrunoFileType,
) {
    const commonArgs: CommonParsingArgs = {
        docHelper,
        fullDocumentRange: docHelper.getTextRange(),
    };
    const collectedErrors: YamlParsingError[] = [];
    const infoKey = TopLevelRequestFileProperty.Info;

    const maybeTopLevelMap = parseDocumentIntoYamlMap(commonArgs);
    if ("errors" in maybeTopLevelMap) {
        return {
            ...maybeTopLevelMap,
            result: { reason: ReasonForFieldAbsence.Invalid },
        };
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
        collectedErrors.push(
            getErrorForMissingKeyInMap({
                ...commonArgs,
                missingKey: infoKey,
                map: topLevelMap,
            }),
        );
        return {
            errors: collectedErrors,
            result: {
                reason:
                    missingKeys.length > 0
                        ? ReasonForFieldAbsence.Missing
                        : ReasonForFieldAbsence.Invalid,
            },
        };
    }
    const infoMap = validMaps[0];
    const maybeResult = parseFileInfoFromYamlMap({
        infoMap,
        commonArgs,
        fileType,
    });

    return {
        ...maybeResult,
        errors: collectedErrors.concat(maybeResult.errors),
    };
}
