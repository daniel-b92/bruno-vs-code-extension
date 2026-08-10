import {
    ParsedInfo,
    Range,
    TextDocumentHelper,
    WithKeyAndValueRange,
    YamlParsingError,
    YamlParsingErrorCode,
} from "../../..";
import {
    CommonParsingArgs,
    FileInfoProperty,
    FileInfoType,
    TopLevelRequestOrFolderSettingsProperty,
    WithKeyAndKeyRange,
} from "../../internal/yamlFormat/interfaces";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { isSeq, Scalar, YAMLMap } from "yaml";
import { getErrorForUnknownKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForUnknownKeyInMap";
import { getRangeForItem } from "../../internal/yamlFormat/util/getRangeForItem";
import { getTypedScalarFromList } from "../../internal/yamlFormat/scalars/getTypedScalarFromList";
import { mapFromYamlScalar } from "../../internal/yamlFormat/scalars/mapFromYamlScalar";

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
    return getResultFromInfoYamlMap(infoMap, commonArgs);
}

function getResultFromInfoYamlMap(
    {
        keyRange: infoKeyRange,
        value: infoMap,
    }: WithKeyAndKeyRange<YAMLMap<unknown, unknown>>,
    commonArgs: CommonParsingArgs,
): Result {
    const errors: YamlParsingError[] = [];
    const expectedStringScalars = [
        FileInfoProperty.Name,
        FileInfoProperty.Type,
    ];
    const expectedNumericScalars = [FileInfoProperty.Seq];
    const expectedSequenceValues = [FileInfoProperty.Tags];
    const allowedKeys = expectedStringScalars.concat(
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
                allowedKeys: allowedKeys,
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
    const name = validStringScalars.find(
        ({ key }) => key == FileInfoProperty.Name,
    )!;

    const maybeType = getTypedScalarFromList(
        {
            commonParsingArgs: commonArgs,
            allowedValues: Object.values(FileInfoType),
            allStringScalars: validStringScalars,
            keyName: FileInfoProperty.Type,
        },
        errors,
    );
    const maybeSequence = validNumericScalars.find(
        ({ key }) => key == FileInfoProperty.Seq,
    );
    let sequenceToUse: WithKeyAndValueRange<number> | undefined = undefined;

    if (
        maybeSequence &&
        Number.isInteger(maybeSequence.value.value) &&
        maybeSequence.value.value > 0
    ) {
        sequenceToUse = mapFromYamlScalar({ ...commonArgs, ...maybeSequence });
    } else if (maybeSequence) {
        errors.push({
            message:
                "Only integer values that are greater than zero are allowed.",
            range: getRangeForItem(maybeSequence.value, commonArgs),
            code: YamlParsingErrorCode.Other,
        });
    }

    const maybeUntypedTagsField =
        validSequences.length > 0 ? validSequences[0] : undefined;
    let tagsToUse:
        WithKeyAndValueRange<{ value: string; range: Range }[]> | undefined =
        undefined;

    if (
        maybeUntypedTagsField &&
        isSeq<Scalar<string>>(validSequences[0].value)
    ) {
        const value = validSequences[0].value.items.map((item) => ({
            value: item.value,
            range: getRangeForItem(item, commonArgs),
        }));
        tagsToUse = {
            keyRange: maybeUntypedTagsField.keyRange,
            valueRange: getRangeForItem(
                maybeUntypedTagsField.value,
                commonArgs,
            ),
            value,
        };
    } else if (maybeUntypedTagsField) {
        errors.push({
            message:
                "Tags sequence may only contain values that are Scalar strings.",
            range: getRangeForItem(maybeUntypedTagsField.value, commonArgs),
            code: YamlParsingErrorCode.Other,
        });
    }

    return {
        errors,
        info: {
            keyRange: infoKeyRange,
            valueRange: getRangeForItem(infoMap, commonArgs),
            value: {
                name: mapFromYamlScalar({ ...commonArgs, ...name }),
                sequence: sequenceToUse,
                type: maybeType ? maybeType.value : undefined,
                tags: tagsToUse,
            },
        },
    };
}
