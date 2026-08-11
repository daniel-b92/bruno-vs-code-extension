import { YAMLSeq } from "yaml";
import { YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    ParsedRequestHeader,
    ParsingResult,
    RequestHeaderProperty,
    WithKeyAndKeyRange,
} from "../interfaces";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { mapFromYamlScalar } from "../scalars/mapFromYamlScalar";
import { getRangeForItem } from "../util/getRangeForItem";
import { getMapItems } from "./getMapItems";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";

export type ParsedInfoResult = ParsingResult<ParsedRequestHeader[]>;

export function parseHeadersFromYamlMap(args: {
    commonArgs: CommonParsingArgs;
    headersSequence: WithKeyAndKeyRange<YAMLSeq>;
}): ParsedInfoResult {
    const {
        commonArgs,
        headersSequence: { value: headersSeq },
    } = args;
    const errors: YamlParsingError[] = [];
    const result: ParsedRequestHeader[] = [];

    const { items: headerMaps, errors: errorsFromSeq } =
        getYamlMapsFromSequence({
            ...commonArgs,
            sequence: headersSeq,
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
            return errors;
        }

        const description = validStrings.find(
            ({ key }) => key == RequestHeaderProperty.Description,
        );
        const maybeDisabled = validBooleans.find(
            ({ key }) => key == RequestHeaderProperty.Disabled,
        );

        result.push({
            name: mapFromYamlScalar({
                ...commonArgs,
                ...name,
                keyRange: getRangeForItem(name.value, commonArgs),
            }),
            value: mapFromYamlScalar({
                ...commonArgs,
                ...value,
                keyRange: getRangeForItem(value.value, commonArgs),
            }),
            description: description
                ? mapFromYamlScalar({
                      ...commonArgs,
                      ...description,
                      keyRange: getRangeForItem(description.value, commonArgs),
                  })
                : undefined,
            disabled: {
                effectiveValue:
                    // The default value is `false`, if not explicitly defined.
                    maybeDisabled !== undefined
                        ? maybeDisabled.value.value
                        : false,
                field: maybeDisabled
                    ? mapFromYamlScalar({ ...commonArgs, ...maybeDisabled })
                    : undefined,
            },
        });
    }

    return {
        errors,
        result,
    };
}
