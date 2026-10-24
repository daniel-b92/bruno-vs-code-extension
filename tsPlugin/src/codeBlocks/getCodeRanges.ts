import * as ts from "typescript/lib/tsserverlibrary";
import { isFileFromYamlCollection } from "../collection/collectionFormat";
import { getOriginalFileContent } from "../fileContent";
import { isBruFile } from "../fileTypes";
import { PluginConfiguration } from "../pluginConfiguration";
import { getScriptContentRanges } from "../yamlFiles/maskYamlFileContent";
import { getCodeBlockIndizesForBruFile } from "./bruCodeBlocks";

export interface CodeRange {
    start: number;
    end: number;
}

/**
 * Returns a function that determines the ranges of the code for the given `.bru` or Yaml file from the (original) content of the file.
 * Only `.bru` files and Yaml files of Yaml collections can contain code.
 */
export function getCodeRangesGetter(
    info: ts.server.PluginCreateInfo,
    fileName: string,
): (fileContent: string) => CodeRange[] {
    return isBruFile(fileName)
        ? getCodeRangesForBruFile
        : isFileFromYamlCollection(info, fileName)
          ? (fileContent) => getScriptContentRanges(fileName, fileContent)
          : () => [];
}

/**
 * The positions within the closing bracket of a code block and directly in front of it are included.
 */
export function isPositionWithinCode(
    info: ts.server.PluginCreateInfo,
    configuration: PluginConfiguration,
    fileName: string,
    position: number,
) {
    const content = getOriginalFileContent(info, fileName);

    // The Typescript server does not see any content of Yaml files as long as Yaml collections are not supported (see `maskFilesWithCodeBlocksForTypescriptServer`).
    if (
        !content ||
        (!isBruFile(fileName) &&
            !configuration.isYamlCollectionSupportEnabled())
    ) {
        return false;
    }

    return getCodeRangesGetter(
        info,
        fileName,
    )(content).some(({ start, end }) => start <= position && position <= end);
}

function getCodeRangesForBruFile(fileContent: string): CodeRange[] {
    return getCodeBlockIndizesForBruFile(fileContent)
        .map(({ startIndex, endIndex }) => ({
            start: startIndex,
            end: endIndex - 1, // index of the closing bracket
        }))
        .sort(({ start: start1 }, { start: start2 }) => start1 - start2);
}
