import { isMap, isScalar, isSeq, Scalar, YAMLMap } from "yaml";
import {
    Range,
    WithKeyAndValueRange,
    YamlParsingError,
    YamlParsingErrorCode,
} from "../../../..";
import { CommonParsingArgs, ParsedMapItems } from "../interfaces";
import { getRangeForItem } from "../util/getRangeForItem";
import { fromYamlRange } from "../util/fromYamlRange";
import { getRangeForUnknownYamlItem } from "../util/getRangeForUnknownYamlItem";
import { getErrorForValueWithUnexpectedType } from "../parsingErrors/getErrorForValueWithUnexpectedType";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";

/**
 * Parses a YAML map and categorizes its items into valid scalars, valid sequences, invalid scalars, invalid sequences, and unknown keys based on the provided expected keys.
 * It also collects any technical errors encountered during parsing.
 * No errors are collected for items with unknown keys or missing keys.
 */
export function getMapItems(
    map: YAMLMap,
    expectedKeys: {
        scalars: {
            stringValues?: string[];
            booleanValues?: string[];
            numericValues?: string[];
            unknownValues?: string[];
        };
        sequenceValues?: string[];
        mapValues?: string[];
    },
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
    const items: ParsedMapItems = {
        validScalars: {
            withBooleanValue: [],
            withNumericValue: [],
            withStringValue: [],
            withUnknownValue: [],
        },
        validSequences: [],
        validMaps: [],
        // Everytime one of the expected keys is found, it will be removed from this list.
        missingKeys: allExpectedKeys.slice(),
        unknownKeys: [],
    };
    const errors: YamlParsingError[] = [];
    const invalidScalars: { key: string; valueRange: Range }[] = [];
    const invalidSequences: { key: string; valueRange: Range }[] = [];
    const invalidMaps: { key: string; valueRange: Range }[] = [];

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

        // The parser converts empty string for a value to `NULL`, which causes a type mismatch, when directly checking for string scalar.
        if (isScalar<unknown>(value) && value.source === "") {
            items.validScalars.withStringValue.push({
                key: keyValue,
                keyRange,
                value: "",
                valueRange: getRangeForItem(value, commonParsingArgs),
            });
            continue;
        }

        if (isTypedScalar<boolean>(keyValue, value, expectedBooleanScalars)) {
            items.validScalars.withBooleanValue.push({
                ...mapFromYamlScalar({ ...commonParsingArgs, keyRange, value }),
                key: keyValue,
            });
            continue;
        }
        if (isTypedScalar<number>(keyValue, value, expectedNumericScalars)) {
            items.validScalars.withNumericValue.push({
                ...mapFromYamlScalar({ ...commonParsingArgs, keyRange, value }),
                key: keyValue,
            });
            continue;
        }
        if (isTypedScalar<string>(keyValue, value, expectedStringScalars)) {
            items.validScalars.withStringValue.push({
                ...mapFromYamlScalar({ ...commonParsingArgs, keyRange, value }),
                key: keyValue,
            });
            continue;
        }
        if (isTypedScalar<unknown>(keyValue, value, expectedUnknownScalars)) {
            items.validScalars.withUnknownValue.push({
                ...mapFromYamlScalar({ ...commonParsingArgs, keyRange, value }),
                key: keyValue,
            });
            continue;
        }

        if ((expectedSequenceValues ?? []).includes(keyValue) && isSeq(value)) {
            items.validSequences.push({
                key: keyValue,
                keyRange,
                value: value,
            });
            continue;
        }

        if ((expectedMapValues ?? []).includes(keyValue) && isMap(value)) {
            items.validMaps.push({
                key: keyValue,
                keyRange,
                value: value,
            });
            continue;
        }

        const maybeValueRange = getValueRange(
            keyAsScalar.value,
            value,
            map,
            commonParsingArgs,
        );
        if ("error" in maybeValueRange) {
            errors.push(maybeValueRange.error);
            continue;
        }
        const valueRange = maybeValueRange.range;

        if (allExpectedScalars.includes(keyValue)) {
            invalidScalars.push({ key: keyValue, valueRange });
            continue;
        }
        if ((expectedSequenceValues ?? []).includes(keyValue)) {
            invalidSequences.push({
                key: keyValue,
                valueRange,
            });
            continue;
        }
        if ((expectedMapValues ?? []).includes(keyValue)) {
            invalidMaps.push({
                key: keyValue,
                valueRange,
            });
            continue;
        }
    }
    return {
        items,
        errors: errors.concat(
            getImplicitErrorsForAllInvalidMapItems(
                { invalidScalars, invalidSequences, invalidMaps },
                commonParsingArgs,
            ),
        ),
    };
}

function getImplicitErrorsForAllInvalidMapItems(
    items: {
        invalidScalars: { key: string; valueRange: Range }[];
        invalidSequences: { key: string; valueRange: Range }[];
        invalidMaps: { key: string; valueRange: Range }[];
    },
    commonArgs: CommonParsingArgs,
) {
    const { invalidScalars, invalidSequences, invalidMaps } = items;

    return [
        { fields: invalidScalars, type: "Scalar" as const },
        { fields: invalidSequences, type: "Sequence" as const },
        { fields: invalidMaps, type: "Map" as const },
    ].flatMap(({ fields, type }) =>
        fields.map(({ key, valueRange }) =>
            getErrorForValueWithUnexpectedType({
                ...commonArgs,
                key,
                valueRange,
                expectedType: type,
            }),
        ),
    );
}

function isTypedScalar<T>(
    keyValue: string,
    fieldValue: unknown,
    expectedKeys?: string[],
): fieldValue is Scalar<T> {
    return (
        expectedKeys != undefined &&
        expectedKeys.includes(keyValue) &&
        isScalar<T>(fieldValue)
    );
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

function getValueRange(
    keyValue: string,
    valueItem: unknown,
    parentMap: YAMLMap,
    commonParsingArgs: CommonParsingArgs,
): { range: Range } | { error: YamlParsingError } {
    const yamlRange = getRangeForUnknownYamlItem(valueItem);
    const range = yamlRange
        ? fromYamlRange(yamlRange, commonParsingArgs.docHelper)
        : undefined;
    return range
        ? { range }
        : {
              error: {
                  message: `Could not determine range for value of key '${keyValue}'`,
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
