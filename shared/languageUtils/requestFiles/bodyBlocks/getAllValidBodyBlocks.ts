import { RequestFileBlockName } from "../../..";

export function getAllValidBodyBlocks() {
    return Object.values(RequestFileBlockName).filter(
        (name) =>
            name.startsWith("body:") &&
            name != RequestFileBlockName.GraphQlBodyVars,
    ) as string[];
}
