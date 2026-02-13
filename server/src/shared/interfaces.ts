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
