import { EndOfLine } from "vscode";
import {
    CollectionFormat,
    ItemType,
    RequestType,
    BlockRuntimeExecutionGroup,
    JsCodeBlock,
    getJsCodeBlocksFromFile,
} from "@global_shared";
import { getDefinitionsForAllInbuiltLibraries } from "../../../shared/temporaryJsFilesUpdates/internal/inbuiltLibraryDefinitions/getDefinitionsForAllInbuiltLibraries";
import {
    mapBlockNameToJsFileLine,
    TypedParameter,
} from "./mapBlockNameToJsFileLine";
import { getCharacterForLineBreak } from "./getCharacterForLineBreak";

export function getTempJsFileContent(
    sourceFileContent: string,
    eol: EndOfLine,
    itemType: ItemType,
    format: CollectionFormat,
) {
    const { requestType, blocks } = getJsCodeBlocksFromFile(
        sourceFileContent,
        itemType,
        format,
    );

    const isGrpc = requestType == RequestType.Grpc;
    const lineBreak = getCharacterForLineBreak(eol);

    const blocksForTempJsFile = blocks.map(
        (block) => `${mapBlockNameToJsFileLine(
            block.name,
            getShadowingParameters(block, isGrpc),
        )}
${block.content}${endsWithLineBreak(block.content) ? "" : lineBreak}}`,
    );

    return getDefinitionsForAllInbuiltLibraries(eol, false, requestType)
        .concat(isGrpc ? [grpcBruTypeDefinitions] : [])
        .concat(blocksForTempJsFile)
        .join(lineBreak.repeat(2));
}

function endsWithLineBreak(content: string) {
    return content.endsWith("\n");
}

const grpcBruTypeDefinitions = `/** @typedef {Omit<typeof bru, "grpc"> & { grpc: Pick<typeof bru.grpc, "request"> }} BruForPreRequestGrpc */
/** @typedef {Omit<typeof bru, "grpc"> & { grpc: Pick<typeof bru.grpc, "response"> }} BruForPostResponseGrpc */
/** @typedef {Omit<typeof bru, "grpc">} BruWithoutGrpc */`;

/**
 * `bru.grpc.request` / `req` are only available before the request is sent.
 * `bru.grpc.response` / `res` are only available after the response was received.
 * `req` is additionally available in `tests` blocks.
 */
function getShadowingParameters(
    { executionGroup, isTestsBlock }: JsCodeBlock,
    isGrpc: boolean,
): TypedParameter[] {
    if (isGrpc) {
        return [
            {
                name: "bru",
                type:
                    executionGroup == BlockRuntimeExecutionGroup.PreRequest
                        ? "BruForPreRequestGrpc"
                        : executionGroup ==
                            BlockRuntimeExecutionGroup.PostResponse
                          ? "BruForPostResponseGrpc"
                          : "BruWithoutGrpc",
            },
        ];
    }

    return executionGroup == BlockRuntimeExecutionGroup.PreRequest
        ? [{ name: "res", type: "undefined" }]
        : executionGroup == BlockRuntimeExecutionGroup.PostResponse &&
            !isTestsBlock
          ? [{ name: "req", type: "undefined" }]
          : [];
}
