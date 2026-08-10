import { ParsedInfo, TextDocumentHelper, YamlParsingError } from "../../..";
import {
    CommonParsingArgs,
    FileInfoProperty,
    TopLevelRequestOrFolderSettingsProperty,
} from "../../internal/yamlFormat/interfaces";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { YAMLMap } from "yaml";
import { getErrorForUnknownKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForUnknownKeyInMap";

type Result =
    | YamlParsingError[]
    | {
          info: ParsedInfo;
          errors: YamlParsingError[];
      };

export function parseInfoFromYamlFile(docHelper: TextDocumentHelper): Result {
    const fullDocumentRange = docHelper.getTextRange();
    const commonArgs: CommonParsingArgs = { docHelper, fullDocumentRange };
    const collectedErrors: YamlParsingError[] = [];
    const infoKey = TopLevelRequestOrFolderSettingsProperty.Info;

    const maybTopLevelMap = parseDocumentIntoYamlMap(commonArgs);
    if ("errors" in maybTopLevelMap) {
        return maybTopLevelMap.errors;
    }

    const { map: topLevelMap } = maybTopLevelMap;
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
}

function getResultFromInfoYamlMap(
    infoMap: YAMLMap<unknown, unknown>,
    commonArgs: CommonParsingArgs,
): Result {
    const errors: YamlParsingError[] = [];
    const expectedStringScalars = [
        FileInfoProperty.Name,
        FileInfoProperty.Type,
    ];
    const expectedNumericScalars = [FileInfoProperty.Seq];
    const expectedSequenceValues = [FileInfoProperty.Tags];
    const allAllowedKeys = expectedStringScalars.concat(
        expectedNumericScalars,
        expectedSequenceValues,
    );

    const {
        items: {
            missingKeys,
            unknownKeys,
            validScalars: {
                withStringValue: validStringScalars,
                withNumericValue: validNumericScalars,
            },
            validSequences,
        },
        errors: mapItemErrors,
    } = getMapItems(
        infoMap,
        {
            scalars: {
                stringValues: expectedStringScalars,
                numericValues: expectedNumericScalars,
            },
            sequenceValues: expectedSequenceValues,
        },
        commonArgs,
    );

    errors.push(
        ...mapItemErrors,
        ...unknownKeys.map(({ key: unknownKey, keyRange }) =>
            getErrorForUnknownKeyInMap({
                ...commonArgs,
                unknownKey,
                keyRange,
                allowedKeys: allAllowedKeys,
            }),
        ),
    );
    if (missingKeys.includes(FileInfoProperty.Name)) {
        // Name is the only mandatory property.
        return errors.concat(
            getErrorForMissingKeyInMap({
                ...commonArgs,
                missingKey: FileInfoProperty.Name,
                map: infoMap,
            }),
        );
    }
}
