import { CancellationToken } from "vscode";

export enum TempJsUpdateType {
    Creation = "Creation",
    Deletion = "Deletion",
}

export interface TempJsUpdateRequest {
    collectionRootFolder: string;
    update:
        | { type: TempJsUpdateType.Creation; bruFileContent: string }
        | { type: TempJsUpdateType.Deletion };
    cancellationToken?: CancellationToken;
}
