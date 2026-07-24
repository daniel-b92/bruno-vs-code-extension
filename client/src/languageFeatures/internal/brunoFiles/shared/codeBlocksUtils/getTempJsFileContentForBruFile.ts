import { EndOfLine } from "vscode";
import {
    parseBruFile,
    TextDocumentHelper,
    getCodeBlocks,
    ItemType,
} from "@global_shared";
import { getDefinitionsForInbuiltLibraries } from "../../../shared/temporaryJsFilesUpdates/external/getDefinitionsForInbuiltLibraries";
import { mapBlockNameToJsFileLine } from "./mapBlockNameToJsFileFunctionName";
import { getCharacterForLineBreak } from "./getCharacterForLineBreak";

export function getTempJsFileContentForBruFile(
    bruFileContent: string,
    eol: EndOfLine,
    itemType: ItemType,
) {
    const { blocks: parsedBlocks } = parseBruFile(
        new TextDocumentHelper(bruFileContent),
        itemType,
    );

    const functionsForTempJsFile = getCodeBlocks(parsedBlocks).map(
        ({ name, content }) => `${mapBlockNameToJsFileLine(name)}
${content}}`,
    );

    return getDefinitionsForInbuiltLibraries(eol)
        .concat(functionsForTempJsFile)
        .join(getCharacterForLineBreak(eol).repeat(2));
}
