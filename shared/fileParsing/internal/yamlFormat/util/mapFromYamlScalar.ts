import { Scalar, Range as YamlRange } from "yaml";
import { Range, WithKeyAndValueRange } from "../../../..";
import { CommonParsingArgs } from "../interfaces";
import { fromYamlRange } from "./fromYamlRange";

export function mapFromYamlScalar<T>(
    args: { keyRange: Range; value: Scalar<T> } & CommonParsingArgs,
): WithKeyAndValueRange<T> {
    const { value: valueField, keyRange } = args;

    return {
        keyRange,
        valueRange: fromYamlRangeWithFallback({
            ...args,
            source: valueField.range,
        }),
        value: valueField.value,
    };
}

function fromYamlRangeWithFallback(
    args: CommonParsingArgs & {
        source: YamlRange | null | undefined;
    },
) {
    const { docHelper, fullDocumentRange, source } = args;
    return source
        ? (fromYamlRange(source, docHelper) ?? fullDocumentRange)
        : fullDocumentRange;
}
