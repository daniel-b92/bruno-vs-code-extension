import {
    Block,
    getAllMethodBlocks,
    getPossibleMethodBlocksForRequestType,
    getActiveSimpleFieldFromDictionaryBlockIfExistsOnce,
    MetaBlockKey,
    RequestFileBlockName,
    RequestType,
} from "@global_shared";
import { DiagnosticSeverity } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

/**
 * For gRPC requests, the method block needs to be the `grpc` block.
 * For all other request types, the `grpc` block is not valid (this is already covered by another check for the gRPC specific blocks).
 */
export function checkMethodBlockMatchesRequestType(
    filePath: string,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    const requestTypeField =
        getActiveSimpleFieldFromDictionaryBlockIfExistsOnce(
            blocks,
            RequestFileBlockName.Meta,
            MetaBlockKey.Type,
        );

    if (requestTypeField?.value != RequestType.Grpc) {
        return undefined;
    }

    const validMethodBlocks: string[] = getPossibleMethodBlocksForRequestType(
        requestTypeField.value,
    );
    const invalidMethodBlocks = getAllMethodBlocks(blocks).filter(
        ({ name }) => !validMethodBlocks.includes(name),
    );

    return invalidMethodBlocks.length > 0
        ? {
              message: `Request type '${RequestType.Grpc}' requires the method block '${validMethodBlocks.join("', '")}'.`,
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
