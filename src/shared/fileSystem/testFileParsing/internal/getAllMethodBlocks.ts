import { RequestFileBlock } from "../definitions/interfaces";
import { RequestFileBlockName } from "../definitions/requestFileBlockNameEnum";

export function getAllMethodBlocks(parsedBlocks: RequestFileBlock[]) {
    const possibleMethodBlocks = getPossibleMethodBlocks() as string[];

    return parsedBlocks.filter(({ name }) =>
        possibleMethodBlocks.includes(name)
    );
}

export function getPossibleMethodBlocks() {
    return [
        RequestFileBlockName.Get,
        RequestFileBlockName.Put,
        RequestFileBlockName.Post,
        RequestFileBlockName.Delete,
        RequestFileBlockName.Patch,
        RequestFileBlockName.Head,
        RequestFileBlockName.Options,
    ];
}
