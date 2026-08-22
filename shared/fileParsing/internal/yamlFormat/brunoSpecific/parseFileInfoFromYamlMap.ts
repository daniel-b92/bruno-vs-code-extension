import { isSeq, Scalar, YAMLMap, YAMLSeq } from "yaml";
import {
    BrunoFileType,
    ParsedInfoForRequestFile,
    YamlParsingError,
    YamlParsingErrorCode,
} from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    WithKeyAndKeyRange,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import { getRangeForItem } from "../util/getRangeForItem";
import { getMapItems } from "../yamlMaps/getMapItems";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import {
    FileInfoProperty,
    FileInfoType,
} from "../../../external/yamlFormat/constants/sharedConstants";

export type ParsedInfoResult = MaybeResultWithErrors<ParsedInfoForRequestFile>;

export function parseFileInfoFromYamlMap(args: {
    commonArgs: CommonParsingArgs;
    fileType: BrunoFileType;
    infoMap: WithKeyAndKeyRange<YAMLMap>;
}): ParsedInfoResult {
    const {
        commonArgs,
        fileType,
        infoMap: { keyRange: infoKeyRange, value: infoMap },
    } = args;
    const errors: YamlParsingError[] = [];
    const checkForTypeProperty = [
        BrunoFileType.AppFile,
        BrunoFileType.FolderSettingsFile,
        BrunoFileType.RequestFile,
    ].includes(fileType);
    const checkForSeqProperty = [
        BrunoFileType.AppFile,
        BrunoFileType.FolderSettingsFile,
        BrunoFileType.RequestFile,
    ].includes(fileType);
    const checkForTagsProperty = fileType == BrunoFileType.RequestFile;
    const expectedStringScalars = [FileInfoProperty.Name].concat(
        checkForTypeProperty ? FileInfoProperty.Type : [],
    );
    const expectedNumericScalars = checkForSeqProperty
        ? [FileInfoProperty.Seq]
        : [];
    const expectedSequenceValues = checkForTagsProperty
        ? [FileInfoProperty.Tags]
        : [];
    const allowedKeys = expectedStringScalars.concat(
        expectedNumericScalars,
        expectedSequenceValues,
    );
    const allExpectedScalars = expectedStringScalars.concat(
        expectedNumericScalars,
    );
    const alwaysMandatoryKey = FileInfoProperty.Name;
    const mandatoryKeys = [alwaysMandatoryKey].concat(
        [BrunoFileType.FolderSettingsFile, BrunoFileType.AppFile].includes(
            fileType,
        )
            ? FileInfoProperty.Type
            : [FileInfoProperty.Type, FileInfoProperty.Seq],
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
        ...missingKeys
            .filter((key) => (mandatoryKeys as string[]).includes(key))
            .map((key) =>
                getErrorForMissingKeyInMap({
                    ...commonArgs,
                    missingKey: key,
                    map: infoMap,
                }),
            ),
    );
    const missingProperties = missingKeys.map((key) => ({
        alwaysHasScalarValue: (allExpectedScalars as string[]).includes(key),
        isMandatory: (mandatoryKeys as string[]).includes(key),
        key,
    }));
    const name = validStringScalars.find(
        ({ key }) => key == FileInfoProperty.Name,
    );
    const maybeType = !checkForTypeProperty
        ? undefined
        : getTypedValueFromList(
              {
                  allowedValues: Object.values(FileInfoType),
                  allStringValues: validStringScalars,
                  keyName: FileInfoProperty.Type,
              },
              errors,
          );

    return {
        errors,
        result: {
            keyRange: infoKeyRange,
            valueRange: getRangeForItem(infoMap, commonArgs),
            missingProperties,
            properties: {
                name: name ? stripKeyFromResult(name) : undefined,
                sequence: checkForSeqProperty
                    ? getSequenceToUse(validNumericScalars, errors)
                    : undefined,
                type: maybeType ? maybeType.value : undefined,
                tags: checkForTagsProperty
                    ? getTagsToUse(validSequences, commonArgs, errors)
                    : undefined,
            },
        },
    };
}

function getSequenceToUse(
    validNumericScalars: WithKeyKeyRangeAndValueRange<number>[],
    errorCollection: YamlParsingError[],
) {
    const actual = validNumericScalars.find(
        ({ key }) => key == FileInfoProperty.Seq,
    );
    if (!actual) {
        return undefined;
    }

    if (Number.isInteger(actual.value) && actual.value > 0) {
        return stripKeyFromResult(actual);
    }

    errorCollection.push({
        message: "Only integer values that are greater than zero are allowed.",
        range: actual.valueRange,
        code: YamlParsingErrorCode.Other,
    });
    return undefined;
}

function getTagsToUse(
    validSequences: WithKeyAndKeyRange<YAMLSeq>[],
    commonArgs: CommonParsingArgs,
    errorCollection: YamlParsingError[],
) {
    const maybeUntypedTagsField =
        validSequences.length > 0 ? validSequences[0] : undefined;

    if (!maybeUntypedTagsField) {
        return undefined;
    }

    if (isSeq<Scalar<string>>(maybeUntypedTagsField.value)) {
        const value = maybeUntypedTagsField.value.items.map((item) => ({
            value: item.value,
            range: getRangeForItem(item, commonArgs),
        }));
        return {
            keyRange: maybeUntypedTagsField.keyRange,
            valueRange: getRangeForItem(
                maybeUntypedTagsField.value,
                commonArgs,
            ),
            value,
        };
    }

    errorCollection.push({
        message:
            "Tags sequence may only contain values that are Scalar strings.",
        range: getRangeForItem(maybeUntypedTagsField.value, commonArgs),
        code: YamlParsingErrorCode.Other,
    });
    return undefined;
}
