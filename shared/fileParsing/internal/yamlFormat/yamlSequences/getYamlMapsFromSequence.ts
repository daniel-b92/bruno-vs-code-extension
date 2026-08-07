import { isMap, YAMLMap, YAMLSeq } from "yaml";
import { CommonParsingArgs } from "../interfaces";
import { YamlParsingError, YamlParsingErrorCode } from "../../../..";
import { getRangeForUnknownYamlItem } from "../util/getRangeForUnknownYamlItem";
import { fromYamlRange } from "../util/fromYamlRange";

export function getYamlMapsFromSequence(
    args: CommonParsingArgs & {
        sequence: YAMLSeq<unknown>;
    },
): { items: YAMLMap<unknown, unknown>[]; errors: YamlParsingError[] } {
    const { sequence, fullDocumentRange, docHelper } = args;

    const items: YAMLMap<unknown, unknown>[] = [];
    const errors: YamlParsingError[] = [];

    for (const item of sequence.items) {
        if (isMap(item)) {
            items.push(item);
            continue;
        }
        const range = getRangeForUnknownYamlItem(item) ?? sequence.range;

        errors.push({
            message: "Sequence items should be Yaml maps",
            range:
                (range ? fromYamlRange(range, docHelper) : fullDocumentRange) ??
                fullDocumentRange,
            code: YamlParsingErrorCode.Other,
        });
    }

    return { items, errors };
}
