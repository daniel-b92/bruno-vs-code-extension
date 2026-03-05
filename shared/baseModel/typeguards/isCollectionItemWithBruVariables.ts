import { CollectionItem, CollectionItemWithBruVariables } from "../..";

export function isCollectionItemWithBruVariables(
    item: CollectionItem,
): item is CollectionItemWithBruVariables {
    return "getVariableReferences" in item;
}
