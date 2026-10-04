import { YAMLMap } from "yaml";
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
} from "../interfaces";
import { getStringListFromSequence } from "../yamlSequences/getStringListFromSequence";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import { getRangeForItem } from "../util/getRangeForItem";
import {
    ValidatedMapItems,
    getValidatedMapItems,
} from "../yamlMaps/getValidatedMapItems";
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
    const mandatoryKeys = getMandatoryKeys(fileType);

    const {
        getString,
        getNumber,
        getSequence,
        items: {
            validScalars: { withStringValue: validStringScalars },
        },
        missingProperties,
    } = getValidatedMapItems(
        infoMap,
        {
            scalars: {
                stringValues: expectedStringScalars,
                numericValues: expectedNumericScalars,
            },
            sequenceValues: expectedSequenceValues,
            mandatoryKeys,
        },
        commonArgs,
        errors,
    );
    const name = getString(FileInfoProperty.Name);
    const maybeType = !checkForTypeProperty
        ? undefined
        : getTypedValueFromList(
              {
                  allowedValues: getAllowedTypes(fileType),
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
                name: stripKeyFromResult(name),
                sequence: checkForSeqProperty
                    ? getSequenceToUse(getNumber, errors)
                    : undefined,
                type: maybeType ? maybeType.value : undefined,
                tags: checkForTagsProperty
                    ? getStringListFromSequence(
                          getSequence(FileInfoProperty.Tags),
                          "Tags",
                          commonArgs,
                          errors,
                      )
                    : undefined,
            },
        },
    };
}

function getAllowedTypes(fileType: BrunoFileType): FileInfoType[] {
    switch (fileType) {
        case BrunoFileType.AppFile:
            return [FileInfoType.App];
        case BrunoFileType.FolderSettingsFile:
            return [FileInfoType.Folder];
        default:
            return [
                FileInfoType.Http,
                FileInfoType.Graphql,
                FileInfoType.Grpc,
                FileInfoType.Websocket,
            ];
    }
}

function getSequenceToUse(
    getNumber: ValidatedMapItems["getNumber"],
    errorCollection: YamlParsingError[],
) {
    const actual = getNumber(FileInfoProperty.Seq);
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

function getMandatoryKeys(fileType: BrunoFileType) {
    switch (fileType) {
        case BrunoFileType.CollectionSettingsFile:
            return [FileInfoProperty.Name];
        case BrunoFileType.FolderSettingsFile:
        case BrunoFileType.AppFile:
            return [FileInfoProperty.Name, FileInfoProperty.Type];
        default:
            return [
                FileInfoProperty.Name,
                FileInfoProperty.Type,
                FileInfoProperty.Seq,
            ];
    }
}
