import { RequestFileBlockName } from "../../../..";

export function getBlocksWithoutVariableSupport() {
    return [
        RequestFileBlockName.Docs,
        RequestFileBlockName.Meta,
        RequestFileBlockName.Settings,
    ];
}
