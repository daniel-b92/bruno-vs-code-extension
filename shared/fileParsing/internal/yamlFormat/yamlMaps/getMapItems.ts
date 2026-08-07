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
    expectedKeys: { scalarValues: string[]; sequenceValues: string[] },
    commonParsingArgs: CommonParsingArgs,
): { items: ParsedMapItems; errors: YamlParsingError[] } {
    const items: ParsedMapItems = {
        validScalars: [],
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

        if (expectedKeys.scalarValues.includes(keyValue) && isScalar(value)) {
            items.validScalars.push({
                key: keyValue,
                keyRange,
                value: value,
            });
            continue;
        }

        if (expectedKeys.sequenceValues.includes(keyValue) && isSeq(value)) {
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

        if (expectedKeys.scalarValues.includes(keyValue)) {
            items.invalidScalars.push({ key: keyValue, valueRange });
            continue;
        }
        if (expectedKeys.sequenceValues.includes(keyValue)) {
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
