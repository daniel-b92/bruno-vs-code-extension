import {
    Collection,
    CollectionData,
    CollectionItemProvider,
    Position,
    TextDocumentHelper,
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
