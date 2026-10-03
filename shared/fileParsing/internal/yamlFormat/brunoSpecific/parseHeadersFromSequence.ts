import { YAMLSeq } from "yaml";
import { YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    EnabledAndDisabledItems,
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
}): MaybeResultWithErrors<EnabledAndDisabledItems<ParsedRequestHeader>> {
    const { commonArgs, headersSequence } = args;
    const errors: YamlParsingError[] = [];
    const enabled: ParsedRequestHeader[] = [];
    const disabled: ParsedRequestHeader[] = [];

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
        const { getString, getBoolean, missingProperties } =
            getValidatedMapItems(
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

        const name = getString(RequestHeaderProperty.Name);
        const value = getString(RequestHeaderProperty.Value);
        const description = getString(RequestHeaderProperty.Description);
        const maybeDisabled = getBoolean(RequestHeaderProperty.Disabled);

        const header: ParsedRequestHeader = {
            valueRange: getRangeForItem(headerMap, commonArgs),
            properties: {
                name: stripKeyFromResult(name),
                value: stripKeyFromResult(value),
                description: stripKeyFromResult(description),
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
        };
        (header.properties.disabled.effectiveValue ? disabled : enabled).push(
            header,
        );
    }

    return {
        errors,
        result: { enabled, disabled },
    };
}
