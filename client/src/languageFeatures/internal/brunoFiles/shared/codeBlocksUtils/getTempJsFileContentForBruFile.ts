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
import { mapBlockNameToJsFileLine } from "./mapBlockNameToJsFileFunctionName";
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

    const functionsForTempJsFile = getCodeBlocks(parsedBlocks).map(
        ({ name, content }) => `${mapBlockNameToJsFileLine(
            name,
            isGrpc ? getGrpcBruTypeName(name) : undefined,
        )}
${content}}`,
    );

    return getDefinitionsForAllInbuiltLibraries(eol, false, requestType)
        .concat(isGrpc ? [grpcBruTypeDefinitions] : [])
        .concat(functionsForTempJsFile)
        .join(getCharacterForLineBreak(eol).repeat(2));
}

/** `bru.grpc.request` is only available before the request is sent and `bru.grpc.response` only after the response was received. */
const grpcBruTypeDefinitions = `/** @typedef {Omit<typeof bru, "grpc"> & { grpc: Pick<typeof bru.grpc, "request"> }} BruForPreRequestGrpc */
/** @typedef {Omit<typeof bru, "grpc"> & { grpc: Pick<typeof bru.grpc, "response"> }} BruForPostResponseGrpc */
/** @typedef {Omit<typeof bru, "grpc">} BruWithoutGrpc */`;

function getGrpcBruTypeName(blockName: string) {
    switch (getBlockRuntimeExecutionGroup(blockName)) {
        case BlockRuntimeExecutionGroup.PreRequest:
            return "BruForPreRequestGrpc";
        case BlockRuntimeExecutionGroup.PostResponse:
            return "BruForPostResponseGrpc";
        default:
            return "BruWithoutGrpc";
    }
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
