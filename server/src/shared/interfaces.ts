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

export interface VariableBaseRequest {
    collection: TypedCollection;
    baseRequest: LanguageFeatureBaseRequest;
    requestData: VariableSpecificRequestData;
    logger?: Logger;
}

export interface VariableSpecificRequestData {
    variable: {
        name: string;
        start: Position;
        end: Position;
    };
    functionType: VariableReferenceType;
    variableType: BrunoVariableType;
}

export interface LanguageFeatureBaseRequest {
    filePath: string;
    documentHelper: TextDocumentHelper;
    position: Position;
    token: CancellationToken;
}
