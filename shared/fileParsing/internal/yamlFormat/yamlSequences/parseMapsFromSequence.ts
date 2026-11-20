import { YAMLMap, YAMLSeq } from "yaml";
import { YamlParsingError } from "../../../..";
import { CommonParsingArgs, MaybeResultWithErrors } from "../interfaces";
import { getYamlMapsFromSequence } from "./getYamlMapsFromSequence";

/**
 * Parses every map item of the given sequence with the given function.
 * Sequence items that are not maps are reported as errors.
 */
export function parseMapsFromSequence<T>(args: {
    commonArgs: CommonParsingArgs;
    sequence: YAMLSeq;
    parseMap: (map: YAMLMap, errors: YamlParsingError[]) => T;
}): MaybeResultWithErrors<T[]> {
    const { commonArgs, sequence, parseMap } = args;

    const { items, errors } = getYamlMapsFromSequence({
        ...commonArgs,
        sequence,
    });

    return { result: items.map((map) => parseMap(map, errors)), errors };
}
