import {
    isAlias,
    isCollection,
    isDocument,
    isNode,
    isScalar,
    isSeq,
} from "yaml";

export function getRangeForUnknownYamlItem(item: unknown) {
    return isScalar(item) ||
        isSeq(item) ||
        isCollection(item) ||
        isAlias(item) ||
        isDocument(item) ||
        isNode(item)
        ? item.range
        : undefined;
}
