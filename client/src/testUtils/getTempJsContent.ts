import { EndOfLine } from "vscode";
import { BrunoFileType, CollectionFormat } from "@global_shared";
import { getTempJsFileContent } from "../languageFeatures/internal/brunoFiles/shared/codeBlocksUtils/getTempJsFileContent";

export function getTempJsContentForBruRequestFile(bruFileContent: string) {
    return getTempJsContentForRequestFile(bruFileContent, CollectionFormat.Bru);
}

export function getTempJsContentForYamlRequestFile(yamlFileContent: string) {
    return getTempJsContentForRequestFile(
        yamlFileContent,
        CollectionFormat.Yaml,
    );
}

function getTempJsContentForRequestFile(
    fileContent: string,
    format: CollectionFormat,
) {
    return getTempJsFileContent(
        fileContent,
        EndOfLine.LF,
        BrunoFileType.RequestFile,
        format,
    );
}
