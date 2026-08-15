import { YAMLSeq } from "yaml";
import { YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    ParsedRequestHeader,
    ParsingResult,
    RequestHeaderProperty,
} from "../interfaces";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { getMapItems } from "../yamlMaps/getMapItems";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import { stripKeyFromResult } from "../util/stripKeyFromResult";

export type ParsedHeadersResult = ParsingResult<ParsedRequestHeader[]>;

export function parseHeadersFromSequence(args: {
    commonArgs: CommonParsingArgs;
    headersSequence: YAMLSeq;
}): ParsedHeadersResult {
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
    const allowedKeys = expectedStringScalars.concat(expectedBooleanScalars);

    for (const headerMap of headerMaps) {
        const {
            items: {
                unknownKeys,
                validScalars: {
                    withStringValue: validStrings,
                    withBooleanValue: validBooleans,
                },
            },
            errors: mapItemErrors,
        } = getMapItems(
            headerMap,
            {
                scalars: {
                    stringValues: expectedStringScalars,
                    booleanValues: expectedBooleanScalars,
                },
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
        const name = validStrings.find(
            ({ key }) => key == RequestHeaderProperty.Name,
        );
        const value = validStrings.find(
            ({ key }) => key == RequestHeaderProperty.Value,
        );
        if (!name || !value) {
            // Name and value are mandatory.
            return errors;
        }

        const description = validStrings.find(
            ({ key }) => key == RequestHeaderProperty.Description,
        );
        const maybeDisabled = validBooleans.find(
            ({ key }) => key == RequestHeaderProperty.Disabled,
        );

        result.push({
            name: stripKeyFromResult(name),
            value: stripKeyFromResult(value),
            description: description
                ? stripKeyFromResult(description)
                : undefined,
            disabled: {
                effectiveValue:
                    // The default value is `false`, if not explicitly defined.
                    maybeDisabled !== undefined ? maybeDisabled.value : false,
                field:
                    maybeDisabled !== undefined
                        ? stripKeyFromResult(maybeDisabled)
                        : undefined,
            },
        });
    }

    return {
        errors,
        result,
    };
}
