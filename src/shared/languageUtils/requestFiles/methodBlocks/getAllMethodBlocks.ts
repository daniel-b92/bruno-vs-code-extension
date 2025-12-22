import { getPossibleMethodBlocks, Block } from "../../..";

export function getAllMethodBlocks(parsedBlocks: Block[]) {
    const possibleMethodBlocks = getPossibleMethodBlocks() as string[];

    return parsedBlocks.filter(({ name }) =>
        possibleMethodBlocks.includes(name),
    );
}
