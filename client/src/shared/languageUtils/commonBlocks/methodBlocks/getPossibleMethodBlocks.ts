import { RequestFileBlockName } from "../../..";

export function getPossibleMethodBlocks() {
    return [
        RequestFileBlockName.Get,
        RequestFileBlockName.Put,
        RequestFileBlockName.Post,
        RequestFileBlockName.Delete,
        RequestFileBlockName.Patch,
        RequestFileBlockName.Head,
        RequestFileBlockName.Options,
        RequestFileBlockName.Http,
    ];
}
