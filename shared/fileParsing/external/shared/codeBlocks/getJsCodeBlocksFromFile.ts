import {
    BlockRuntimeExecutionGroup,
    CollectionFormat,
    FileInfoType,
    ItemType,
    MetaBlockKey,
    Range,
    RequestFileBlockName,
    RequestType,
    ScriptType,
    TextDocumentHelper,
    getSectionRuntimeExecutionGroup,
    getVariableScopeSectionKindForBlockName,
    getCodeBlocks,
    getScriptBlocksFromYamlFile,
    isDictionaryBlockSimpleField,
    parseBruFile,
} from "../../../..";

export interface JsCodeBlock {
    /** Unique within the file. */
    name: string;
    content: string;
    contentRange: Range;
    executionGroup: BlockRuntimeExecutionGroup;
    isTestsBlock: boolean;
}

export function getJsCodeBlocksFromFile(
    fileContent: string,
    itemType: ItemType,
    format: CollectionFormat,
): { requestType?: RequestType; blocks: JsCodeBlock[] } {
    const docHelper = new TextDocumentHelper(fileContent);

    return format == CollectionFormat.Bru
        ? getBlocksFromBruFile(docHelper, itemType)
        : getBlocksFromYamlFile(docHelper, itemType);
}

function getBlocksFromBruFile(
    docHelper: TextDocumentHelper,
    itemType: ItemType,
) {
    const { blocks: parsedBlocks } = parseBruFile(docHelper, itemType);

    return {
        requestType: getRequestTypeFromBruBlocks(parsedBlocks),
        blocks: getCodeBlocks(parsedBlocks).map(
            ({ name, content, contentRange }) => ({
                name,
                content,
                contentRange,
                executionGroup: getSectionRuntimeExecutionGroup(
                    getVariableScopeSectionKindForBlockName(name),
                ),
                isTestsBlock: name == RequestFileBlockName.Tests,
            }),
        ),
    };
}

function getBlocksFromYamlFile(
    docHelper: TextDocumentHelper,
    itemType: ItemType,
) {
    const { requestType, blocks } = getScriptBlocksFromYamlFile(
        docHelper,
        itemType,
    );

    return {
        requestType: requestType && mapToRequestType(requestType),
        blocks: blocks.map(
            ({ name, content, contentRange, scriptType }): JsCodeBlock => ({
                name,
                content,
                contentRange,
                executionGroup:
                    scriptType == ScriptType.BeforeRequest
                        ? BlockRuntimeExecutionGroup.PreRequest
                        : BlockRuntimeExecutionGroup.PostResponse,
                isTestsBlock: scriptType == ScriptType.Tests,
            }),
        ),
    };
}

function mapToRequestType(type: FileInfoType) {
    switch (type) {
        case FileInfoType.Http:
            return RequestType.Http;
        case FileInfoType.Graphql:
            return RequestType.Graphql;
        case FileInfoType.Grpc:
            return RequestType.Grpc;
        case FileInfoType.Websocket:
            return RequestType.Ws;
        default:
            return undefined;
    }
}

function getRequestTypeFromBruBlocks(
    blocks: ReturnType<typeof parseBruFile>["blocks"],
) {
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
