import {
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../../../shared";
import { getDefinitionsForInbuiltLibraries } from "../../../shared/getDefinitionsForInbuiltLibraries";
import { getCodeBlocks } from "./getCodeBlocks";
import { mapBlockNameToJsFileLine } from "./mapBlockNameToJsFileFunctionName";

export function getTempJsFileContentForBruFile(bruFileContent: string) {
    const { blocks: parsedBlocks } = parseBruFile(
        new TextDocumentHelper(bruFileContent),
    );

    const functionsForTempJsFile = getCodeBlocks(parsedBlocks).map(
        ({
            name,
            content,
        }) => `${mapBlockNameToJsFileLine(name as RequestFileBlockName)}
${content}}`,
    );

    return getDefinitionsForInbuiltLibraries()
        .concat(functionsForTempJsFile)
        .join("\n\n");
}
