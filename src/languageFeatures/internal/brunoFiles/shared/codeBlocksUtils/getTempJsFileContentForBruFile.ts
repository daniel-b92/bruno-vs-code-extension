import {
    parseBruFile,
    TextDocumentHelper,
    getCodeBlocks,
} from "../../../../../shared";
import { getDefinitionsForInbuiltLibraries } from "../../../shared/temporaryJsFilesUpdates/external/getDefinitionsForInbuiltLibraries";
import { mapBlockNameToJsFileLine } from "./mapBlockNameToJsFileFunctionName";

export function getTempJsFileContentForBruFile(bruFileContent: string) {
    const { blocks: parsedBlocks } = parseBruFile(
        new TextDocumentHelper(bruFileContent),
    );

    const functionsForTempJsFile = getCodeBlocks(parsedBlocks).map(
        ({ name, content }) => `${mapBlockNameToJsFileLine(name)}
${content.asPlainText}}`,
    );

    return getDefinitionsForInbuiltLibraries()
        .concat(functionsForTempJsFile)
        .join("\n\n");
}
