import {
    Block,
    getAllMethodBlocks,
    getPossibleMethodBlocksForRequestType,
    DictionaryBlockSimpleField,
    RequestType,
} from "@global_shared";
import { DiagnosticSeverity } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

/**
 * For gRPC and websocket requests, the method block needs to be the `grpc` or `ws` block respectively.
 * For all other request types, these blocks are not valid (this is already covered by other checks for the request type specific blocks).
 */
export function checkMethodBlockMatchesRequestType(
    filePath: string,
    blocks: Block[],
    requestTypeField: DictionaryBlockSimpleField | undefined,
): DiagnosticWithCode | undefined {
    const requestType = requestTypeField?.value;

    if (
        !requestTypeField ||
        (requestType != RequestType.Grpc && requestType != RequestType.Ws)
    ) {
        return undefined;
    }

    const validMethodBlocks: string[] =
        getPossibleMethodBlocksForRequestType(requestType);
    const invalidMethodBlocks = getAllMethodBlocks(blocks).filter(
        ({ name }) => !validMethodBlocks.includes(name),
    );

    return invalidMethodBlocks.length > 0
        ? {
              message: `Request type '${requestType}' requires the method block '${validMethodBlocks.join("', '")}'.`,
              range: requestTypeField.valueRange,
              relatedInformation: invalidMethodBlocks.map(
                  ({ name, nameRange }) => ({
                      message: `Method block with name '${name}'`,
                      location: {
                          uri: URI.file(filePath).toString(),
                          range: nameRange,
                      },
                  }),
              ),
              severity: DiagnosticSeverity.Error,
              code: NonBlockSpecificDiagnosticCode.MethodBlockNotMatchingRequestType,
          }
        : undefined;
}
