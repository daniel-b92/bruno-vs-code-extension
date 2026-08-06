import { Scalar, Range as YamlRange } from "yaml";
import { Range, WithKeyAndValueRange } from "../../../..";
import { CommonParsingArgs } from "../interfaces";
import { fromYamlRange } from "./fromYamlRange";

export function mapFromYamlScalar<T>(
    keyRange: Range,
    valueField: Scalar<T>,
    commonParsingArgs: CommonParsingArgs,
): WithKeyAndValueRange<T> {
    const { range: yamlValueRange, value } = valueField;

    return {
        keyRange,
        valueRange: fromYamlRangeWithFallback({
            ...commonParsingArgs,
            source: yamlValueRange,
        }),
        value,
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
