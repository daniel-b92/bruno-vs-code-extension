import * as ts from "typescript/lib/tsserverlibrary";
import { isFileFromYamlCollection } from "../collection/collectionFormat";
import { getOriginalFileContent } from "../fileContent";
import { isBruFile } from "../fileTypes";
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
    fileName: string,
    position: number,
) {
    return createCheckForPositionsWithinCode(info)(fileName, position);
}

/**
 * Same as `isPositionWithinCode`, but the code ranges are only determined once per file (for checking many positions at once).
 */
export function createCheckForPositionsWithinCode(
    info: ts.server.PluginCreateInfo,
) {
    const codeRangesPerFile = new Map<string, CodeRange[]>();

    return (fileName: string, position: number) => {
        if (!codeRangesPerFile.has(fileName)) {
            codeRangesPerFile.set(fileName, getCodeRanges(info, fileName));
        }

        return codeRangesPerFile
            .get(fileName)!
            .some(({ start, end }) => start <= position && position <= end);
    };
}

export function getCodeRanges(
    info: ts.server.PluginCreateInfo,
    fileName: string,
) {
    const content = getOriginalFileContent(info, fileName);

    if (!content) {
        return [];
    }

    return getCodeRangesGetter(info, fileName)(content);
}

function getCodeRangesForBruFile(fileContent: string): CodeRange[] {
    return getCodeBlockIndizesForBruFile(fileContent)
        .map(({ startIndex, endIndex }) => ({
            start: startIndex,
            end: endIndex - 1, // index of the closing bracket
        }))
        .sort(({ start: start1 }, { start: start2 }) => start1 - start2);
}
