import { CancellationToken } from "vscode";

export enum TempJsUpdateType {
    Creation = "Creation",
    Deletion = "Deletion",
}

export interface TempJsUpdateRequest {
    filePath: string;
    update:
        | { type: TempJsUpdateType.Creation; tempJsFileContent: string }
        | { type: TempJsUpdateType.Deletion };
    cancellationToken?: CancellationToken;
}
