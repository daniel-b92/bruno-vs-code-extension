import {
    Collection,
    CollectionData,
    CollectionItemProvider,
    Position,
    TextDocumentHelper,
    Block,
    Logger,
    VariableReferenceType,
} from "@global_shared";
import { CancellationToken } from "vscode-languageserver";

export type TypedCollectionItemProvider =
    CollectionItemProvider<AdditionalCollectionData>;

export type TypedCollection = Collection<AdditionalCollectionData>;

export type TypedCollectionData = CollectionData<AdditionalCollectionData>;

export type AdditionalCollectionData = void;

export interface LanguageRequestWithTestEnvironmentInfo {
    baseRequest: LanguageFeatureBaseRequest;
    itemProvider: TypedCollectionItemProvider;
    configuredEnvironmentName?: string;
    logger?: Logger;
}

export interface LanguageFeatureBaseRequest {
    filePath: string;
    documentHelper: TextDocumentHelper;
    position: Position;
    token: CancellationToken;
}

export type BruFileEnvVariableRequest = EnvVariableBaseRequest & {
    bruFileSpecificData: EnvVariableBruFileSpecificData;
};

export interface EnvVariableBaseRequest {
    requestData: EnvVariableCommonRequestData;
    logger?: Logger;
}

export interface EnvVariableCommonRequestData {
    collection: TypedCollection;
    variable: {
        name: string;
        start: Position;
        end: Position;
    };
    functionType: VariableReferenceType;
    requestPosition: Position;
    token: CancellationToken;
}

export interface EnvVariableBruFileSpecificData {
    blockContainingPosition: Block;
    allBlocks: Block[];
}
