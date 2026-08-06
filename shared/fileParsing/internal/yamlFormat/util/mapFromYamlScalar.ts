import { Scalar } from "yaml";
import { WithRange } from "../../../..";
import { CommonParsingArgs } from "../interfaces";
import { fromYamlRange } from "./fromYamlRange";

export function mapFromYamlScalar<T>(
    source: Scalar<T>,
    { docHelper, fullDocumentRange }: CommonParsingArgs,
): WithRange<T> {
    const { range: yamlRange, value } = source;

    return {
        range: yamlRange
            ? (fromYamlRange(yamlRange, docHelper) ?? fullDocumentRange)
            : fullDocumentRange,
        value,
    };
}
