import { YAMLSeq } from "yaml";
import { YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedHttpParam,
} from "../interfaces";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getMapItems } from "../yamlMaps/getMapItems";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { getRangeForItem } from "../util/getRangeForItem";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import {
    HttpParamType,
    RequestFileHttpSectionParamProperty,
} from "../../../external/yamlFormat/constants/requestFileConstants";

export function parseParamsFromSequence(
    paramsSequence: YAMLSeq,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedHttpParam[]> {
    const errors: YamlParsingError[] = [];
    const result: ParsedHttpParam[] = [];

    const { items: paramMaps, errors: errorsFromSeq } =
        getYamlMapsFromSequence({
            ...commonArgs,
            sequence: paramsSequence,
        });
    errors.push(...errorsFromSeq);

    const expectedStringScalars = [
        RequestFileHttpSectionParamProperty.Name,
        RequestFileHttpSectionParamProperty.Value,
        RequestFileHttpSectionParamProperty.Type,
        RequestFileHttpSectionParamProperty.Description,
    ];
    const expectedBooleanScalars = [
        RequestFileHttpSectionParamProperty.Disabled,
    ];
    const allowedKeys = expectedStringScalars.concat(expectedBooleanScalars);

    for (const paramMap of paramMaps) {
        const {
            items: {
                unknownKeys,
                missingKeys,
                validScalars: {
                    withStringValue: validStrings,
                    withBooleanValue: validBooleans,
                },
            },
            errors: mapItemErrors,
        } = getMapItems(
            paramMap,
            {
                scalars: {
                    stringValues: expectedStringScalars,
                    booleanValues: expectedBooleanScalars,
                },
            },
            commonArgs,
        );

        const missingKeysWithInfo = missingKeys.map((key) => ({
            key,
            isMandatory:
                key == RequestFileHttpSectionParamProperty.Name ||
                key == RequestFileHttpSectionParamProperty.Value,
        }));
        const missingProperties = missingKeysWithInfo.map(
            ({ key, isMandatory }) => ({
                key,
                alwaysHasScalarValue: true,
                isMandatory,
            }),
        );

        errors.push(
            ...mapItemErrors,
            ...unknownKeys.map(({ key: unknownKey, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonArgs,
                    unknownKey,
                    keyRange,
                    allowedKeys,
                }),
            ),
            ...missingKeysWithInfo
                .filter(({ isMandatory }) => isMandatory)
                .map(({ key }) =>
                    getErrorForMissingKeyInMap({
                        ...commonArgs,
                        missingKey: key,
                        map: paramMap,
                    }),
                ),
        );

        const name = validStrings.find(
            ({ key }) => key == RequestFileHttpSectionParamProperty.Name,
        );
        const value = validStrings.find(
            ({ key }) => key == RequestFileHttpSectionParamProperty.Value,
        );
        const description = validStrings.find(
            ({ key }) => key == RequestFileHttpSectionParamProperty.Description,
        );
        const maybeDisabled = validBooleans.find(
            ({ key }) => key == RequestFileHttpSectionParamProperty.Disabled,
        );

        const parsedType = getTypedValueFromList<HttpParamType>(
            {
                allStringValues: validStrings,
                keyName: RequestFileHttpSectionParamProperty.Type,
                allowedValues: Object.values(HttpParamType),
            },
            errors,
        )?.value;

        result.push({
            valueRange: getRangeForItem(paramMap, commonArgs),
            properties: {
                name: name ? stripKeyFromResult(name) : undefined,
                value: value ? stripKeyFromResult(value) : undefined,
                type: parsedType,
                description: description
                    ? stripKeyFromResult(description)
                    : undefined,
                disabled: {
                    effectiveValue:
                        maybeDisabled !== undefined
                            ? maybeDisabled.value
                            : false,
                    field:
                        maybeDisabled !== undefined
                            ? stripKeyFromResult(maybeDisabled)
                            : undefined,
                },
            },
            missingProperties,
        });
    }

    return { errors, result };
}
