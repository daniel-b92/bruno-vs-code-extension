import { CancellationToken } from "vscode";

export enum TempJsUpdateType {
    Creation = "Creation",
    Deletion = "Deletion",
}

export interface TempJsUpdateRequest {
    collectionRootFolder: string;
    filePath: string;
    update:
        | { type: TempJsUpdateType.Creation; newContent: string }
        | { type: TempJsUpdateType.Deletion };
    cancellationToken: CancellationToken;
}
