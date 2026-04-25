import { Block, RequestFileBlockName } from "@global_shared";
import { DiagnosticWithCode } from "../interfaces";
import { checkJsonRequestBodySyntax } from "./checks/singleBlocks/checkJsonRequestBodySyntax";

export function getRequestBodyBlockSpecificDiagnostics(
    bodyBlock: Block,
): (DiagnosticWithCode | undefined)[] {
    return (
        [
            RequestFileBlockName.JsonBody,
            RequestFileBlockName.GraphQlBodyVars,
        ] as string[]
    ).includes(bodyBlock.name)
        ? [checkJsonRequestBodySyntax(bodyBlock)]
        : [];
}
