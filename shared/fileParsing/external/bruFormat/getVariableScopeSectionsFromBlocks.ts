import {
    Block,
    getVariableScopeSectionKindForBlockName,
    VariableScopeSection,
} from "../../..";

export function getVariableScopeSectionsFromBlocks(
    blocks: Block[],
): VariableScopeSection[] {
    return blocks.map(({ name, contentRange, variableReferences }) => ({
        kind: getVariableScopeSectionKindForBlockName(name),
        name,
        range: contentRange,
        variableReferences: variableReferences ?? [],
    }));
}
