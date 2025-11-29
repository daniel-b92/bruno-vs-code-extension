import { RequestFileBlockName } from "../../../../../shared";

export function getNonCodeBlocksWithoutVariableSupport() {
    // In some blocks, variables do not make sense.
    return [
        RequestFileBlockName.Docs,
        RequestFileBlockName.Meta,
        RequestFileBlockName.Settings,
    ];
}
