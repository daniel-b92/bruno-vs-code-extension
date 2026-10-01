import { EndOfLine } from "vscode";
import {
    parseBruFile,
    TextDocumentHelper,
    getCodeBlocks,
    ItemType,
    RequestFileBlockName,
    MetaBlockKey,
    RequestType,
    isDictionaryBlockSimpleField,
} from "@global_shared";
import { getDefinitionsForAllInbuiltLibraries } from "../../../shared/temporaryJsFilesUpdates/internal/inbuiltLibraryDefinitions/getDefinitionsForAllInbuiltLibraries";
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

    return getDefinitionsForAllInbuiltLibraries(
        eol,
        false,
        getRequestType(parsedBlocks),
    )
        .concat(functionsForTempJsFile)
        .join(getCharacterForLineBreak(eol).repeat(2));
}

function getRequestType(blocks: ReturnType<typeof parseBruFile>["blocks"]) {
    const metaContent = blocks.find(
        ({ name }) => name == RequestFileBlockName.Meta,
    )?.content;
    const value = Array.isArray(metaContent)
        ? metaContent
              .filter(isDictionaryBlockSimpleField)
              .find(({ key }) => key == MetaBlockKey.Type)?.value
        : undefined;

    return (Object.values(RequestType) as string[]).includes(value ?? "")
        ? (value as RequestType)
        : undefined;
}
