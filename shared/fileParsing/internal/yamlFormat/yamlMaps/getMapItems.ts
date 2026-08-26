import { isMap, isScalar, isSeq, Scalar, YAMLMap, YAMLSeq } from "yaml";
import {
    Range,
    WithKeyAndValueRange,
    YamlParsingError,
    YamlParsingErrorCode,
} from "../../../..";
import {
    CommonParsingArgs,
    ParsedMapItems,
    WithKeyAndKeyRange,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { getRangeForItem } from "../util/getRangeForItem";
import { fromYamlRange } from "../util/fromYamlRange";
import { getErrorForValueWithUnexpectedType } from "../parsingErrors/getErrorForValueWithUnexpectedType";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";

interface ExpectedKeys {
    scalars: {
        booleanValues?: string[];
        numericValues?: string[];
        stringValues?: string[];
        unknownValues?: string[];
    };
    mapValues?: string[];
    sequenceValues?: string[];
}

interface ValidKeys {
    validScalars: {
        withStringValue: WithKeyKeyRangeAndValueRange<string>[];
        withBooleanValue: WithKeyKeyRangeAndValueRange<boolean>[];
        withNumericValue: WithKeyKeyRangeAndValueRange<number>[];
        withUnknownValue: WithKeyKeyRangeAndValueRange<unknown>[];
    };
    validSequences: WithKeyAndKeyRange<YAMLSeq>[];
    validMaps: WithKeyAndKeyRange<YAMLMap>[];
}

/**
 * Parses a YAML map and categorizes its items into valid scalars, valid sequences, invalid scalars, invalid sequences, and unknown keys based on the provided expected keys.
 * It also collects any technical errors encountered during parsing.
 * No errors are collected for items with unknown keys or missing keys.
 */
export function getMapItems(
    map: YAMLMap,
    expectedKeys: ExpectedKeys,
    commonParsingArgs: CommonParsingArgs,
): { items: ParsedMapItems; errors: YamlParsingError[] } {
    const {
        scalars: {
            booleanValues: expectedBooleanScalars,
            numericValues: expectedNumericScalars,
            stringValues: expectedStringScalars,
            unknownValues: expectedUnknownScalars,
        },
        sequenceValues: expectedSequenceValues,
        mapValues: expectedMapValues,
    } = expectedKeys;
    const allExpectedScalars = (expectedBooleanScalars ?? []).concat(
        expectedNumericScalars ?? [],
        expectedStringScalars ?? [],
        expectedUnknownScalars ?? [],
    );
    const allExpectedKeys = allExpectedScalars.concat(
        expectedSequenceValues ?? [],
        expectedMapValues ?? [],
    );
    const validKeys: ValidKeys = {
        validScalars: {
            withBooleanValue: [],
            withNumericValue: [],
            withStringValue: [],
            withUnknownValue: [],
        },
        validSequences: [],
        validMaps: [],
    };
    const items: ParsedMapItems = {
        ...validKeys,
        // Everytime one of the expected keys is found, it will be removed from this list.
        missingKeys: allExpectedKeys.slice(),
        unknownKeys: [],
    };
    const errors: YamlParsingError[] = [];

    for (const { key, value } of map.items) {
        // The parser converts empty string as key to `NULL`, which causes a type mismatch, when directly checking for string scalar.
        if (isScalar<unknown>(key) && key.source === "") {
            errors.push(
                getErrorForUnknownKeyInMap({
                    ...commonParsingArgs,
                    unknownKey: "",
                    keyRange: getRangeForItem(key, commonParsingArgs),
                    allowedKeys: allExpectedKeys,
                }),
            );
            continue;
        }
        const keyAsScalar = isScalar<string>(key) ? key : undefined;

        if (!keyAsScalar) {
            errors.push({
                message: `Non scalar string key '${key} defined'`,
                range: getRangeForItem(map, commonParsingArgs),
                code: YamlParsingErrorCode.Other,
            });
            continue;
        }

        const { value: keyValue } = keyAsScalar;
        const maybeKeyRange = getKeyRange(keyAsScalar, map, commonParsingArgs);
        if ("error" in maybeKeyRange) {
            errors.push(maybeKeyRange.error);
            continue;
        }
        const keyRange = maybeKeyRange.range;

        const missingKeyIndex = items.missingKeys.findIndex(
            (notFoundYet) => notFoundYet == keyValue,
        );
        if (missingKeyIndex >= 0) {
            items.missingKeys.splice(missingKeyIndex, 1);
        } else {
            items.unknownKeys.push({ key: keyValue, keyRange });
            continue;
        }

        if (isScalar<unknown>(value)) {
            handleScalarValue(
                { key: keyValue, keyRange, value },
                expectedKeys,
                {
                    collectedValidKeys: items,
                    errors,
                },
                commonParsingArgs,
            );
            continue;
        }

        if (isSeq(value)) {
            if (expectedSequenceValues?.includes(keyValue)) {
                items.validSequences.push({
                    key: keyValue,
                    keyRange,
                    value: value,
                });
            } else {
                const valueRange = getRangeForItem(value, commonParsingArgs);
                errors.push(
                    getErrorForUnexpectedType(
                        { key: keyValue, valueRange },
                        expectedKeys,
                        commonParsingArgs,
                    ),
                );
            }
            continue;
        }

        if (isMap(value)) {
            if (expectedMapValues?.includes(keyValue)) {
                items.validMaps.push({
                    key: keyValue,
                    keyRange,
                    value: value,
                });
            } else {
                const valueRange = getRangeForItem(value, commonParsingArgs);
                errors.push(
                    getErrorForUnexpectedType(
                        { key: keyValue, valueRange },
                        expectedKeys,
                        commonParsingArgs,
                    ),
                );
            }
            continue;
        }
    }

    return {
        items,
        errors,
    };
}

function handleScalarValue(
    field: {
        key: string;
        keyRange: Range;
        value: Scalar;
    },
    expectedKeys: ExpectedKeys,
    results: {
        collectedValidKeys: ValidKeys;
        errors: YamlParsingError[];
    },
    commonParsingArgs: CommonParsingArgs,
) {
    const { key, keyRange, value } = field;
    const { collectedValidKeys, errors } = results;
    const {
        scalars: {
            booleanValues: expectedBooleanScalars,
            numericValues: expectedNumericScalars,
            stringValues: expectedStringScalars,
            unknownValues: expectedUnknownScalars,
        },
    } = expectedKeys;
    const {
        validScalars: {
            withBooleanValue: validBooleanScalars,
            withNumericValue: validNumericScalars,
            withStringValue: validStringScalars,
            withUnknownValue: validUnknownScalars,
        },
    } = collectedValidKeys;
    const valueRange = getRangeForItem(value, commonParsingArgs);

    // The parser converts empty strings to `NULL`, which causes a type mismatch, when directly checking for string scalars.
    if (isScalar<unknown>(value) && value.source === "") {
        if (expectedStringScalars?.includes(key)) {
            validStringScalars.push({
                key,
                keyRange,
                value: "",
                valueRange,
            });
        } else {
            errors.push(
                getErrorForUnexpectedType(
                    { key, valueRange },
                    expectedKeys,
                    commonParsingArgs,
                ),
            );
        }
        return;
    }

    if (isScalar<boolean>(value)) {
        if (expectedBooleanScalars?.includes(key)) {
            validBooleanScalars.push({
                ...mapFromYamlScalar({
                    ...commonParsingArgs,
                    keyRange,
                    value,
                }),
                key,
            });
        } else {
            errors.push(
                getErrorForUnexpectedType(
                    { key, valueRange },
                    expectedKeys,
                    commonParsingArgs,
                ),
            );
        }
        return;
    }

    if (isScalar<number>(value)) {
        if (expectedNumericScalars?.includes(key)) {
            validNumericScalars.push({
                ...mapFromYamlScalar({
                    ...commonParsingArgs,
                    keyRange,
                    value,
                }),
                key,
            });
        } else {
            errors.push(
                getErrorForUnexpectedType(
                    { key, valueRange },
                    expectedKeys,
                    commonParsingArgs,
                ),
            );
        }
        return;
    }

    if (isScalar<string>(value)) {
        if (expectedStringScalars?.includes(key)) {
            validStringScalars.push({
                ...mapFromYamlScalar({
                    ...commonParsingArgs,
                    keyRange,
                    value,
                }),
                key,
            });
        } else {
            errors.push(
                getErrorForUnexpectedType(
                    { key, valueRange },
                    expectedKeys,
                    commonParsingArgs,
                ),
            );
        }
        return;
    }

    if (expectedUnknownScalars?.includes(key)) {
        validUnknownScalars.push({
            ...mapFromYamlScalar({
                ...commonParsingArgs,
                keyRange,
                value,
            }),
            key,
        });
        return;
    }

    errors.push(
        getErrorForUnexpectedType(
            { key, valueRange },
            expectedKeys,
            commonParsingArgs,
        ),
    );
    return;
}

function getErrorForUnexpectedType(
    field: {
        key: string;
        valueRange: Range;
    },
    expectedKeys: ExpectedKeys,
    commonParsingArgs: CommonParsingArgs,
) {
    const { key, valueRange } = field;
    const {
        scalars: {
            booleanValues: expectedBooleanScalars,
            numericValues: expectedNumericScalars,
            stringValues: expectedStrinǵScalars,
            unknownValues: expectedUnknownScalars,
        },
        sequenceValues: expectedSequenceValues,
        mapValues: expectedMapValues,
    } = expectedKeys;
    const keyToTypeMap = (expectedBooleanScalars ?? [])
        .map((key) => ({ key, type: "boolean" }))
        .concat(
            (expectedNumericScalars ?? []).map((key) => ({
                key,
                type: "number",
            })),
            (expectedStrinǵScalars ?? []).map((key) => ({
                key,
                type: "string",
            })),
            (expectedUnknownScalars ?? []).map((key) => ({
                key,
                type: "unknown",
            })),
            (expectedMapValues ?? []).map((key) => ({
                key,
                type: "Map",
            })),
            (expectedSequenceValues ?? []).map((key) => ({
                key,
                type: "Sequence",
            })),
        );

    const expectedType = keyToTypeMap.find(({ key: k }) => k == key)?.type;
    return getErrorForValueWithUnexpectedType({
        ...commonParsingArgs,
        key,
        valueRange,
        expectedType: expectedType ?? "unknown",
    });
}

function getKeyRange(
    key: Scalar,
    parentMap: YAMLMap,
    commonParsingArgs: CommonParsingArgs,
): { range: Range } | { error: YamlParsingError } {
    const yamlRange = key.range;
    const range = yamlRange
        ? fromYamlRange(yamlRange, commonParsingArgs.docHelper)
        : undefined;
    return range
        ? { range }
        : {
              error: {
                  message: `Could not determine range for key '${key}'`,
                  range: getRangeForItem(parentMap, commonParsingArgs),
                  code: YamlParsingErrorCode.Other,
              },
          };
}

function mapFromYamlScalar<T>(
    args: { keyRange: Range; value: Scalar<T> } & CommonParsingArgs,
): WithKeyAndValueRange<T> {
    const { value: valueField, keyRange } = args;

    return {
        keyRange,
        valueRange: getRangeForItem(valueField, args),
        value: valueField.value,
    };
}
