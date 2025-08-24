import { CancellationToken } from "vscode";

export enum TempJsUpdateType {
    Creation = "Creation",
    Deletion = "Deletion",
}

export interface TempJsUpdateRequest {
    update:
        | {
              type: TempJsUpdateType.Creation;
              filePath: string;
              tempJsFileContent: string;
          }
        | { type: TempJsUpdateType.Deletion; filePaths: string[] };
    cancellationToken?: CancellationToken;
}
