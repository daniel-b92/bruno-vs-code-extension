import { Block } from "@global_shared";
import { DiagnosticWithCode } from "../definitions";
import { checkJsonRequestBodySyntax } from "./checks/singleBlocks/checkJsonRequestBodySyntax";

export function getRequestBodyBlockSpecificDiagnostics(
    bodyBlock: Block,
): (DiagnosticWithCode | undefined)[] {
    return [checkJsonRequestBodySyntax(bodyBlock)];
}
