import {
    CollectionData,
    CollectionItemProvider,
    Position,
    TextDocumentHelper,
    Logger,
    VariableReferenceType,
    BrunoVariableReference,
    BrunoVariableType,
    ReadyOnlyCollection,
    LineBreakType,
    VariableScopeSectionKind,
} from "@global_shared";
import { CancellationToken } from "vscode-languageserver";

export type TypedCollectionItemProvider =
    CollectionItemProvider<AdditionalCollectionData>;

export type TypedCollection = ReadyOnlyCollection<AdditionalCollectionData>;

export type TypedCollectionData = CollectionData<AdditionalCollectionData>;

export type AdditionalCollectionData =
    | {
          reference: BrunoVariableReference;
          sectionKind: VariableScopeSectionKind;
          sectionName: string;
      }[]
    | undefined;

export interface LanguageRequestWithTestEnvironmentInfo {
    baseRequest: LanguageFeatureBaseRequest;
    itemProvider: TypedCollectionItemProvider;
    collection: TypedCollection;
    configuredEnvironmentName?: string;
    logger?: Logger;
}

export interface JsFileInContextRootRequest {
    baseRequest: LanguageFeatureBaseRequest;
    collections: {
        collection: TypedCollection;
        configuredEnvironmentName?: string;
    }[];
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
    documentLineBreak: LineBreakType;
}

export interface LanguageFeatureBaseRequest {
    filePath: string;
    documentHelper: TextDocumentHelper;
    position: Position;
    token: CancellationToken;
}
