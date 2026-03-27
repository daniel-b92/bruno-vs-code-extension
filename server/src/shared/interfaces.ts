import {
    Collection,
    CollectionData,
    CollectionItemProvider,
    Position,
    TextDocumentHelper,
    Logger,
    VariableReferenceType,
    BrunoVariableReference,
    BrunoVariableType,
} from "@global_shared";
import { CancellationToken } from "vscode-languageserver";

export type TypedCollectionItemProvider =
    CollectionItemProvider<AdditionalCollectionData>;

export type TypedCollection = Collection<AdditionalCollectionData>;

export type TypedCollectionData = CollectionData<AdditionalCollectionData>;

export type AdditionalCollectionData = BrunoVariableReference[] | undefined;

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

export interface VariableBaseRequest {
    requestData: VariableCommonRequestData;
    logger?: Logger;
}

export interface VariableCommonRequestData {
    collection: TypedCollection;
    variable: {
        name: string;
        start: Position;
        end: Position;
    };
    functionType: VariableReferenceType;
    variableType: BrunoVariableType;
    requestPosition: Position;
    token: CancellationToken;
}
