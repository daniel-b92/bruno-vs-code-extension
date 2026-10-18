import { YAMLSeq } from "yaml";
import { YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    EnabledAndDisabledItems,
    MaybeResultWithErrors,
    ParsedHttpParam,
} from "../interfaces";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { getRangeForItem } from "../util/getRangeForItem";
import {
    HttpParamType,
    RequestFileHttpSectionParamProperty,
} from "../../../external/yamlFormat/constants/requestFileConstants";

export function parseParamsFromSequence(
    paramsSequence: YAMLSeq,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<EnabledAndDisabledItems<ParsedHttpParam>> {
    const errors: YamlParsingError[] = [];
    const enabled: ParsedHttpParam[] = [];
    const disabled: ParsedHttpParam[] = [];

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
        const { getString, getBoolean, getEnumValue } = getValidatedMapItems(
            paramMap,
            {
                scalars: {
                    stringValues: expectedStringScalars,
                    booleanValues: expectedBooleanScalars,
                    enumValues: {
                        [RequestFileHttpSectionParamProperty.Type]:
                            Object.values(HttpParamType),
                    },
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

        const parsedType = getEnumValue<HttpParamType>(
            RequestFileHttpSectionParamProperty.Type,
        );

        const param: ParsedHttpParam = {
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
        };
        (param.properties.disabled.effectiveValue ? disabled : enabled).push(
            param,
        );
    }

    return { errors, result: { enabled, disabled } };
}
