import { Block, RequestFileBlockName } from "@global_shared";
import { DiagnosticWithCode } from "../interfaces";
import { checkJsonRequestBodySyntax } from "./checks/singleBlocks/checkJsonRequestBodySyntax";

export function getRequestBodyOrGraphQlBlockSpecificDiagnostics(
    block: Block,
): (DiagnosticWithCode | undefined)[] {
    return (
        [
            RequestFileBlockName.JsonBody,
            RequestFileBlockName.GraphQlBodyVars,
        ] as string[]
    ).includes(block.name)
        ? [checkJsonRequestBodySyntax(block)]
        : [];
}
