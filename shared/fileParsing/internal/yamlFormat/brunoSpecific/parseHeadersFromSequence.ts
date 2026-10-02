import { YAMLSeq } from "yaml";
import { YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedRequestHeader,
} from "../interfaces";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { RequestHeaderProperty } from "../../../external/yamlFormat/constants/sharedConstants";
import { getRangeForItem } from "../util/getRangeForItem";

export function parseHeadersFromSequence(args: {
    commonArgs: CommonParsingArgs;
    headersSequence: YAMLSeq;
}): MaybeResultWithErrors<ParsedRequestHeader[]> {
    const { commonArgs, headersSequence } = args;
    const errors: YamlParsingError[] = [];
    const result: ParsedRequestHeader[] = [];

    const { items: headerMaps, errors: errorsFromSeq } =
        getYamlMapsFromSequence({
            ...commonArgs,
            sequence: headersSequence,
        });
    errors.push(...errorsFromSeq);

    const expectedStringScalars = [
        RequestHeaderProperty.Name,
        RequestHeaderProperty.Value,
        RequestHeaderProperty.Description,
    ];
    const expectedBooleanScalars = [RequestHeaderProperty.Disabled];
    for (const headerMap of headerMaps) {
        const {
            items: {
                validScalars: {
                    withStringValue: validStrings,
                    withBooleanValue: validBooleans,
                },
            },
            missingProperties,
        } = getValidatedMapItems(
            headerMap,
            {
                scalars: {
                    stringValues: expectedStringScalars,
                    booleanValues: expectedBooleanScalars,
                },
                mandatoryKeys: [
                    RequestHeaderProperty.Name,
                    RequestHeaderProperty.Value,
                ],
            },
            commonArgs,
            errors,
        );

        const name = validStrings.find(
            ({ key }) => key == RequestHeaderProperty.Name,
        );
        const value = validStrings.find(
            ({ key }) => key == RequestHeaderProperty.Value,
        );
        const description = validStrings.find(
            ({ key }) => key == RequestHeaderProperty.Description,
        );
        const maybeDisabled = validBooleans.find(
            ({ key }) => key == RequestHeaderProperty.Disabled,
        );

        result.push({
            valueRange: getRangeForItem(headerMap, commonArgs),
            properties: {
                name: name ? stripKeyFromResult(name) : undefined,
                value: value ? stripKeyFromResult(value) : undefined,
                description: description
                    ? stripKeyFromResult(description)
                    : undefined,
                disabled: {
                    effectiveValue:
                        // The default value is `false`, if not explicitly defined.
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

    return {
        errors,
        result,
    };
}
