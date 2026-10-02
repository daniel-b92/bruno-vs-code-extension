import { YAMLSeq } from "yaml";
import { YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedHttpParam,
} from "../interfaces";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
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

    const { items: paramMaps, errors: errorsFromSeq } = getYamlMapsFromSequence(
        {
            ...commonArgs,
            sequence: paramsSequence,
        },
    );
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
    for (const paramMap of paramMaps) {
        const {
            getString,
            getBoolean,
            items: {
                validScalars: { withStringValue: validStrings },
            },
            missingProperties,
        } = getValidatedMapItems(
            paramMap,
            {
                scalars: {
                    stringValues: expectedStringScalars,
                    booleanValues: expectedBooleanScalars,
                },
                mandatoryKeys: [
                    RequestFileHttpSectionParamProperty.Name,
                    RequestFileHttpSectionParamProperty.Value,
                ],
            },
            commonArgs,
            errors,
        );

        const name = getString(RequestFileHttpSectionParamProperty.Name);
        const value = getString(RequestFileHttpSectionParamProperty.Value);
        const description = getString(
            RequestFileHttpSectionParamProperty.Description,
        );
        const maybeDisabled = getBoolean(
            RequestFileHttpSectionParamProperty.Disabled,
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
                name: stripKeyFromResult(name),
                value: stripKeyFromResult(value),
                type: parsedType,
                description: stripKeyFromResult(description),
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
