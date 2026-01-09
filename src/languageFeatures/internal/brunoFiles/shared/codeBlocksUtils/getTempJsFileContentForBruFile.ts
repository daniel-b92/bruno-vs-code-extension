import { EndOfLine } from "vscode";
import {
    parseBruFile,
    TextDocumentHelper,
    getCodeBlocks,
} from "../../../../../shared";
import { getDefinitionsForInbuiltLibraries } from "../../../shared/temporaryJsFilesUpdates/external/getDefinitionsForInbuiltLibraries";
import { mapBlockNameToJsFileLine } from "./mapBlockNameToJsFileFunctionName";
import { getCharacterForLineBreak } from "./getCharacterForLineBreak";

export function getTempJsFileContentForBruFile(
    bruFileContent: string,
    eol: EndOfLine,
) {
    const { blocks: parsedBlocks } = parseBruFile(
        new TextDocumentHelper(bruFileContent),
    );

    const functionsForTempJsFile = getCodeBlocks(parsedBlocks).map(
        ({ name, content }) => `${mapBlockNameToJsFileLine(name)}
${content.asPlainText}}`,
    );

    return getDefinitionsForInbuiltLibraries(eol)
        .concat(functionsForTempJsFile)
        .join(getCharacterForLineBreak(eol).repeat(2));
}
