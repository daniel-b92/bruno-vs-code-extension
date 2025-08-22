import { getDefinitionsForInbuiltLibraries } from "../../shared/getDefinitionsForInbuiltLibraries";

export function mapSourceFileToTempJsFileContent(sourceFileContent: string) {
    return getDefinitionsForInbuiltLibraries()
        .concat(sourceFileContent)
        .join("\n\n");
}
