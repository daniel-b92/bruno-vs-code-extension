import { EndOfLine } from "vscode";
import { BrunoFileType } from "@global_shared";
import { getTempJsFileContentForBruFile } from "../languageFeatures/internal/brunoFiles/shared/codeBlocksUtils/getTempJsFileContentForBruFile";

export function getTempJsContentForRequestFile(bruFileContent: string) {
    return getTempJsFileContentForBruFile(
        bruFileContent,
        EndOfLine.LF,
        BrunoFileType.RequestFile,
    );
}
