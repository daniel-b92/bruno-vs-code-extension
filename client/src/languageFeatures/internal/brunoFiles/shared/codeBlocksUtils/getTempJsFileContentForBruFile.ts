import { EndOfLine } from "vscode";
import {
    parseBruFile,
    TextDocumentHelper,
    getCodeBlocks,
    ItemType,
    RequestFileBlockName,
    MetaBlockKey,
    RequestType,
    isDictionaryBlockSimpleField,
    BlockRuntimeExecutionGroup,
    getBlockRuntimeExecutionGroup,
} from "@global_shared";
import { getDefinitionsForAllInbuiltLibraries } from "../../../shared/temporaryJsFilesUpdates/internal/inbuiltLibraryDefinitions/getDefinitionsForAllInbuiltLibraries";
import {
    mapBlockNameToJsFileLine,
    TypedParameter,
} from "./mapBlockNameToJsFileLine";
import { getCharacterForLineBreak } from "./getCharacterForLineBreak";

export function getTempJsFileContentForBruFile(
    bruFileContent: string,
    eol: EndOfLine,
    itemType: ItemType,
) {
    const { blocks: parsedBlocks } = parseBruFile(
        new TextDocumentHelper(bruFileContent),
        itemType,
    );

    const requestType = getRequestType(parsedBlocks);
    const isGrpc = requestType == RequestType.Grpc;

    const blocksForTempJsFile = getCodeBlocks(parsedBlocks).map(
        ({ name, content }) => `${mapBlockNameToJsFileLine(
            name,
            getShadowingParameters(name, isGrpc),
        )}
${content}}`,
    );

    return getDefinitionsForAllInbuiltLibraries(eol, false, requestType)
        .concat(isGrpc ? [grpcBruTypeDefinitions] : [])
        .concat(blocksForTempJsFile)
        .join(getCharacterForLineBreak(eol).repeat(2));
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
    blockName: string,
    isGrpc: boolean,
): TypedParameter[] {
    const group = getBlockRuntimeExecutionGroup(blockName);

    if (isGrpc) {
        return [
            {
                name: "bru",
                type:
                    group == BlockRuntimeExecutionGroup.PreRequest
                        ? "BruForPreRequestGrpc"
                        : group == BlockRuntimeExecutionGroup.PostResponse
                          ? "BruForPostResponseGrpc"
                          : "BruWithoutGrpc",
            },
        ];
    }

    return group == BlockRuntimeExecutionGroup.PreRequest
        ? [{ name: "res", type: "undefined" }]
        : group == BlockRuntimeExecutionGroup.PostResponse &&
            blockName != RequestFileBlockName.Tests
          ? [{ name: "req", type: "undefined" }]
          : [];
}

function getRequestType(blocks: ReturnType<typeof parseBruFile>["blocks"]) {
    const metaContent = blocks.find(
        ({ name }) => name == RequestFileBlockName.Meta,
    )?.content;
    const value = Array.isArray(metaContent)
        ? metaContent
              .filter(isDictionaryBlockSimpleField)
              .find(({ key }) => key == MetaBlockKey.Type)?.value
        : undefined;

    return (Object.values(RequestType) as string[]).includes(value ?? "")
        ? (value as RequestType)
        : undefined;
}
