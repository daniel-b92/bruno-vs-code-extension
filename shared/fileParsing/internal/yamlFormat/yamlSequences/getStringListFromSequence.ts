import { isSeq, Scalar, YAMLSeq } from "yaml";
import { Range, YamlParsingError, YamlParsingErrorCode } from "../../../..";
import { CommonParsingArgs, WithKeyAndKeyRange } from "../interfaces";
import { getRangeForItem } from "../util/getRangeForItem";

/**
 * @param sequenceName Used for the error message, if the sequence contains items that are not Scalar strings.
 */
export function getStringListFromSequence(
    sequenceField: WithKeyAndKeyRange<YAMLSeq> | undefined,
    sequenceName: string,
    commonArgs: CommonParsingArgs,
    errorCollection: YamlParsingError[],
) {
    if (!sequenceField) {
        return undefined;
    }

    if (
        isSeq<Scalar>(sequenceField.value) &&
        sequenceField.value.items.every(({ value }) => typeof value == "string")
    ) {
        const value = (sequenceField.value.items as Scalar<string>[]).map(
            (item): { value: string; range: Range } => ({
                value: item.value,
                range: getRangeForItem(item, commonArgs),
            }),
        );
        return {
            keyRange: sequenceField.keyRange,
            valueRange: getRangeForItem(sequenceField.value, commonArgs),
            value,
        };
    }

    errorCollection.push({
        message: `${sequenceName} sequence may only contain values that are Scalar strings.`,
        range: getRangeForItem(sequenceField.value, commonArgs),
        code: YamlParsingErrorCode.Other,
    });
    return undefined;
}
