import { Block } from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { RelevantWithinBodyBlockDiagnosticCode } from "../../../shared/diagnosticCodes/relevantWithinBodyBlockDiagnosticCodeEnum";
import { checkJsonSyntax } from "../../../../../shared";

export function checkJsonRequestBodySyntax(
    requestBody: Block,
): DiagnosticWithCode | undefined {
    if (typeof requestBody.content != "string") {
        return undefined;
    }

    const result = checkJsonSyntax(
        {
            content: requestBody.content,
            contentRange: requestBody.contentRange,
        },
        true,
    );

    return result
        ? {
              ...result.diagnostic,
              code: result.isUnexpectedError
                  ? RelevantWithinBodyBlockDiagnosticCode.UnexpectedErrorWhileParsingJson
                  : RelevantWithinBodyBlockDiagnosticCode.JsonSyntaxNotValid,
          }
        : undefined;
}
