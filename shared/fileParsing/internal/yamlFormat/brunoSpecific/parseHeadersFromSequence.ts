import { YAMLSeq } from "yaml";
import { YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedRequestHeader,
} from "../interfaces";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { getMapItems } from "../yamlMaps/getMapItems";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { RequestHeaderProperty } from "./constants/sharedConstants";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
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
    const allowedKeys = expectedStringScalars.concat(expectedBooleanScalars);

    for (const headerMap of headerMaps) {
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
            headerMap,
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
                // Name and value are mandatory.
                key == RequestHeaderProperty.Name ||
                key == RequestHeaderProperty.Value,
        }));
        const missingProperties = missingKeysWithInfo.map(
            ({ key, isMandatory }) => ({
                key,
                hasScalarValue: true,
                isMandatory,
            }),
        );

        errors.push(
            ...mapItemErrors,
            ...unknownKeys.map(
                ({ key: unknownKey, keyRange }) =>
                    getErrorForUnknownKeyInMap({
                        ...commonArgs,
                        unknownKey,
                        keyRange,
                        allowedKeys: allowedKeys,
                    }),
                ...missingKeysWithInfo
                    .filter(({ isMandatory }) => isMandatory)
                    .map(({ key }) =>
                        getErrorForMissingKeyInMap({
                            ...commonArgs,
                            missingKey: key,
                            map: headerMap,
                        }),
                    ),
            ),
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
