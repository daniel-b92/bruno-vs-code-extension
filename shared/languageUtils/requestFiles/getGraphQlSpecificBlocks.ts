import { RequestFileBlockName } from "../..";

export function getGraphQlSpecificBlocks() {
    return [
        RequestFileBlockName.GraphQlBody,
        RequestFileBlockName.GraphQlBodyVars,
    ];
}
