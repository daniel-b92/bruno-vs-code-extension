import { Range } from "../../../..";
import { CommonParsingArgs } from "../interfaces";
import { fromYamlRange } from "./fromYamlRange";
import { Range as YamlRange } from "yaml";

export function getRangeForItem(
    item: { range?: YamlRange | null | undefined },
    { docHelper, fullDocumentRange }: CommonParsingArgs,
): Range {
    return (
        (item.range
            ? fromYamlRange(item.range, docHelper)
            : fullDocumentRange) ?? fullDocumentRange
    );
}
