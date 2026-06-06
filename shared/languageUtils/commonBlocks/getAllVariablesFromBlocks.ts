import { Block } from "../..";

export function getAllVariablesFromBlocks(blocks: Block[]) {
    return blocks.flatMap(({ variableReferences, name }) =>
        variableReferences
            ? variableReferences.map((reference) => ({
                  reference,
                  block: name,
              }))
            : [],
    );
}
