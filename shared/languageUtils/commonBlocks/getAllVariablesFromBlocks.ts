import { Block } from "../..";

export function getAllVariablesFromBlocks(blocks: Block[]) {
    return blocks.flatMap(({ variableReferences }) => variableReferences ?? []);
}
