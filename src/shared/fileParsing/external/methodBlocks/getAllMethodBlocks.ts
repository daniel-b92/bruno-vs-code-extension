import { RequestFileBlock } from "../interfaces";
import { getPossibleMethodBlocks } from "../../..";

export function getAllMethodBlocks(parsedBlocks: RequestFileBlock[]) {
    const possibleMethodBlocks = getPossibleMethodBlocks() as string[];

    return parsedBlocks.filter(({ name }) =>
        possibleMethodBlocks.includes(name)
    );
}
