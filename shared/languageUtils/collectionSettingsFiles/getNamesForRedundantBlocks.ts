import { RequestFileBlockName } from "../..";

export function getNamesForRedundantBlocks(): string[] {
    return [RequestFileBlockName.Meta];
}
