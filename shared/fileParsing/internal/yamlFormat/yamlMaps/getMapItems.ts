import { isScalar, isSeq, Scalar, YAMLMap } from "yaml";
import { Range, YamlParsingError, YamlParsingErrorCode } from "../../../..";
import { CommonParsingArgs, ParsedMapItems } from "../interfaces";
import { getRangeForItem } from "../util/getRangeForItem";
import { fromYamlRange } from "../util/fromYamlRange";
import { getRangeForUnknownYamlItem } from "../util/getRangeForUnknownYamlItem";

/**
 * Parses a YAML map and categorizes its items into valid scalars, valid sequences, invalid scalars, invalid sequences, and unknown keys based on the provided expected keys.
 * It also collects any technical errors encountered during parsing.
 * No errors are collected for items that have a different type than expected.
 * The same is the case for items with unknown keys.
 */
export function getMapItems(
    map: YAMLMap<unknown, unknown>,
    expectedKeys: {
        scalars: {
            stringValues?: string[];
            booleanValues?: string[];
            unknownValues?: string[];
        };
        sequenceValues?: string[];
    },
    commonParsingArgs: CommonParsingArgs,
): { items: ParsedMapItems; errors: YamlParsingError[] } {
    const items: ParsedMapItems = {
        validScalars: {
            withBooleanValue: [],
            withStringValue: [],
            withUnknownValue: [],
        },
        validSequences: [],
        invalidScalars: [],
        invalidSequences: [],
        unknownKeys: [],
    };
    const errors: YamlParsingError[] = [];

    for (const { key, value } of map.items) {
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

        const {
            scalars: {
                booleanValues: expectedBooleanScalars,
                stringValues: expectedStringScalars,
                unknownValues: expectedUnknownScalars,
            },
            sequenceValues: expectedSequenceValues,
        } = expectedKeys;

        if (isTypedScalar<boolean>(keyValue, value, expectedBooleanScalars)) {
            items.validScalars.withBooleanValue.push({
                key: keyValue,
                keyRange,
                value,
            });
            continue;
        }
        if (isTypedScalar<string>(keyValue, value, expectedStringScalars)) {
            items.validScalars.withStringValue.push({
                key: keyValue,
                keyRange,
                value,
            });
            continue;
        }
        if (isTypedScalar<unknown>(keyValue, value, expectedUnknownScalars)) {
            items.validScalars.withUnknownValue.push({
                key: keyValue,
                keyRange,
                value,
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

        const allExpectedScalars = (expectedBooleanScalars ?? []).concat(
            expectedStringScalars ?? [],
            expectedUnknownScalars ?? [],
        );

        if (allExpectedScalars.includes(keyValue)) {
            items.invalidScalars.push({ key: keyValue, valueRange });
            continue;
        }
        if ((expectedSequenceValues ?? []).includes(keyValue)) {
            items.invalidSequences.push({
                key: keyValue,
                valueRange,
            });
            continue;
        }

        items.unknownKeys.push({ key: keyValue, keyRange });
    }

    return { items, errors };
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
    key: Scalar<unknown>,
    parentMap: YAMLMap<unknown, unknown>,
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
    parentMap: YAMLMap<unknown, unknown>,
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
