import {
    Collection,
    CollectionData,
    CollectionItemProvider,
    Position,
    TextDocumentHelper,
    Block,
    Logger,
    VariableReferenceType,
    CodeBlock,
} from "@global_shared";
import { CancellationToken } from "vscode-languageserver";

export type TypedCollectionItemProvider =
    CollectionItemProvider<AdditionalCollectionData>;

export type TypedCollection = Collection<AdditionalCollectionData>;

export type TypedCollectionData = CollectionData<AdditionalCollectionData>;

export type AdditionalCollectionData = void;

export interface CodeBlockRequestWithAdditionalData {
    request: LanguageFeatureBaseRequest;
    file: {
        collection: TypedCollection;
        allBlocks: Block[];
        blockContainingPosition: CodeBlock;
    };
    logger?: Logger;
}

export interface NonCodeBlockRequestWithAdditionalData {
    request: LanguageFeatureBaseRequest;
    file: {
        allBlocks: Block[];
        blockContainingPosition: Block;
        collection?: TypedCollection;
    };
    logger?: Logger;
}

export interface LanguageFeatureBaseRequest {
    filePath: string;
    documentHelper: TextDocumentHelper;
    position: Position;
    token: CancellationToken;
}

export interface EnvVariableRequest {
    requestData: EnvVariableCommonRequestData;
    bruFileSpecificData?: EnvVariableBruFileSpecificData;
    logger?: Logger;
}

export interface EnvVariableCommonRequestData {
    collection: TypedCollection;
    variableName: string;
    functionType: VariableReferenceType;
    requestPosition: Position;
    token: CancellationToken;
}

export interface EnvVariableBruFileSpecificData {
    blockContainingPosition: Block;
    allBlocks: Block[];
}
