import { Block, getBlockRuntimeExecutionGroup } from "../../../..";

export function getBlocksWithLaterExecutionGroups(
    referenceBlockName: string,
    allBlocks: Block[],
) {
    const referenceBlockExecutionGroup =
        getBlockRuntimeExecutionGroup(referenceBlockName);

    return allBlocks.filter(
        ({ name }) =>
            getBlockRuntimeExecutionGroup(name) > referenceBlockExecutionGroup,
    );
}
