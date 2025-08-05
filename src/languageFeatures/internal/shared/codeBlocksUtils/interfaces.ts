import { CancellationToken } from "vscode";
import { Block, Collection } from "../../../../shared";

export interface TempJsSyncRequest {
    collection: Collection;
    bruFileContentSnapshot: string;
    bruFileCodeBlocksSnapshot: Block[];
    bruFilePath: string;
    token: CancellationToken;
}
