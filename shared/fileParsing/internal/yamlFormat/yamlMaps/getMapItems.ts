import { isScalar, isSeq, Scalar, YAMLMap, YAMLSeq } from "yaml";
import { Range, YamlParsingError } from "../../../..";
import { CommonParsingArgs } from "../interfaces";
import { getRangeForError } from "../util/getRangeForError";
import { fromYamlRange } from "../util/fromYamlRange";

interface ParsedMapItems {
    validScalars: { key: string; value: Scalar<unknown> }[];
    validSequences: { key: string; value: YAMLSeq<unknown> }[];
    invalidScalars: { key: string; keyRange: Range }[];
    invalidSequences: { key: string; keyRange: Range }[];
    unknownKeys: { key: string; keyRange: Range }[];
}

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
                range: getRangeForError(map, commonParsingArgs),
            });
            continue;
        }

        const { value: keyValue } = keyAsScalar;

        if (expectedKeys.scalarValues.includes(keyValue) && isScalar(value)) {
            items.validScalars.push({ key: keyValue, value });
            continue;
        }

        if (expectedKeys.sequenceValues.includes(keyValue) && isSeq(value)) {
            items.validSequences.push({ key: keyValue, value });
            continue;
        }

        const maybeKeyRange = getKeyRange(keyAsScalar, map, commonParsingArgs);
        if ("error" in maybeKeyRange) {
            errors.push(maybeKeyRange.error);
            continue;
        }
        const keyRange = maybeKeyRange.range;

        if (expectedKeys.scalarValues.includes(keyValue)) {
            items.invalidScalars.push({ key: keyValue, keyRange });
            continue;
        }

        if (expectedKeys.sequenceValues.includes(keyValue)) {
            items.invalidSequences.push({ key: keyValue, keyRange });
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
    const keyYamlRange = key.range;
    const keyRange = keyYamlRange
        ? fromYamlRange(keyYamlRange, commonParsingArgs.docHelper)
        : undefined;
    return keyRange
        ? { range: keyRange }
        : {
              error: {
                  message: `Could not determine range for key '${key}'`,
                  range: getRangeForError(parentMap, commonParsingArgs),
              },
          };
}
