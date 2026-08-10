import { Scalar } from "yaml";
import { Range, WithKeyAndValueRange } from "../../../..";
import { CommonParsingArgs } from "../interfaces";
import { getRangeForItem } from "../util/getRangeForItem";

export function mapFromYamlScalar<T>(
    args: { keyRange: Range; value: Scalar<T> } & CommonParsingArgs,
): WithKeyAndValueRange<T> {
    const { value: valueField, keyRange } = args;

    return {
        keyRange,
        valueRange: getRangeForItem(valueField, args),
        value: valueField.value,
    };
}
