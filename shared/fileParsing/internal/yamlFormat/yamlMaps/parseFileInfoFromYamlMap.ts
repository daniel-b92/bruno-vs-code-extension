import { isSeq, Scalar, YAMLMap, YAMLSeq } from "yaml";
import {
    BrunoFileType,
    ParsedInfoForRequestFile,
    YamlParsingError,
    YamlParsingErrorCode,
} from "../../../..";
import {
    CommonParsingArgs,
    FileInfoProperty,
    FileInfoType,
    WithKeyAndKeyRange,
} from "../interfaces";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { getTypedScalarFromList } from "../scalars/getTypedScalarFromList";
import { mapFromYamlScalar } from "../scalars/mapFromYamlScalar";
import { getRangeForItem } from "../util/getRangeForItem";
import { getMapItems } from "./getMapItems";

export type ParsedInfoResult =
    | YamlParsingError[]
    | {
          info: ParsedInfoForRequestFile;
          errors: YamlParsingError[];
      };

export function parseFileInfoFromYamlMap(
    args: {
        commonArgs: CommonParsingArgs;
        fileType: BrunoFileType;
        infoMap: WithKeyAndKeyRange<YAMLMap<unknown, unknown>>;
    },
    errors: YamlParsingError[],
): ParsedInfoResult {
    const {
        commonArgs,
        fileType,
        infoMap: { keyRange: infoKeyRange, value: infoMap },
    } = args;
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
    const name = validStringScalars.find(
        ({ key }) => key == FileInfoProperty.Name,
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
    if (!name) {
        // Case where the Name property is not a Scalar string.
        return errors;
    }

    const maybeType = !checkForTypeProperty
        ? undefined
        : getTypedScalarFromList(
              {
                  commonParsingArgs: commonArgs,
                  allowedValues: Object.values(FileInfoType),
                  allStringScalars: validStringScalars,
                  keyName: FileInfoProperty.Type,
              },
              errors,
          );

    return {
        errors,
        info: {
            keyRange: infoKeyRange,
            valueRange: getRangeForItem(infoMap, commonArgs),
            value: {
                name: mapFromYamlScalar({ ...commonArgs, ...name }),
                sequence: checkForSeqProperty
                    ? getSequenceToUse(validNumericScalars, commonArgs, errors)
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
    validNumericScalars: WithKeyAndKeyRange<Scalar<number>>[],
    commonArgs: CommonParsingArgs,
    errorCollection: YamlParsingError[],
) {
    const maybeSequence = validNumericScalars.find(
        ({ key }) => key == FileInfoProperty.Seq,
    );
    if (!maybeSequence) {
        return undefined;
    }

    if (
        Number.isInteger(maybeSequence.value.value) &&
        maybeSequence.value.value > 0
    ) {
        return mapFromYamlScalar({ ...commonArgs, ...maybeSequence });
    }

    errorCollection.push({
        message: "Only integer values that are greater than zero are allowed.",
        range: getRangeForItem(maybeSequence.value, commonArgs),
        code: YamlParsingErrorCode.Other,
    });
    return undefined;
}

function getTagsToUse(
    validSequences: WithKeyAndKeyRange<YAMLSeq<unknown>>[],
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
