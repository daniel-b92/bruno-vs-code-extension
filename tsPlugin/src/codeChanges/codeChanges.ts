import * as ts from "typescript/lib/tsserverlibrary";
import { getCodeBlockIndizesForBruFile } from "../codeBlocks/bruCodeBlocks";
import { isFileFromYamlCollection } from "../collection/collectionFormat";
import { getOriginalFileContent } from "../fileContent";
import { hasEmbeddedCodeBlocks, isBruFile } from "../fileTypes";
import { getIndentationOfScripts } from "../yamlFiles/getIndentationOfScripts";
import { getScriptContentRanges } from "../yamlFiles/maskYamlFileContent";

/**
 * The Typescript server indents the top-level statements of scripts in Yaml files relative to column 0,
 * since each script is wrapped in a block that is not indented (see `maskYamlCollectionFileContent`).
 * Inserted lines (e.g. when extracting a constant) would therefore end the Yaml block scalar.
 * To avoid this, the base indentation is set to the indentation of the scripts minus one indentation level for the wrapping block.
 */
export function getFormatOptionsForFile(
    info: ts.server.PluginCreateInfo,
    fileName: string,
    formatOptions: ts.FormatCodeSettings,
    range: { start: number; end: number },
): ts.FormatCodeSettings {
    if (!isFileFromYamlCollection(info, fileName)) {
        return formatOptions;
    }

    const originalContent = getOriginalFileContent(info, fileName);
    const scriptIndentation = originalContent
        ? getIndentationOfScripts(originalContent, range)
        : undefined;
    const indentSize =
        formatOptions.indentSize ??
        ts.getDefaultFormatCodeSettings().indentSize!;

    if (scriptIndentation == undefined || scriptIndentation < indentSize) {
        return formatOptions;
    }

    return {
        ...formatOptions,
        baseIndentSize: scriptIndentation - indentSize,
        // Tabs are not allowed for indenting Yaml content.
        convertTabsToSpaces: true,
    };
}

/**
 * Checks whether the given changes only modify the code within code blocks, if they affect '.bru' or '.yml' files.
 */
export function areAllChangesWithinCodeBlocks(
    info: ts.server.PluginCreateInfo,
    changes: readonly ts.FileTextChanges[],
) {
    return changes.every(({ fileName, textChanges, isNewFile }) => {
        if (!hasEmbeddedCodeBlocks(fileName)) {
            return true;
        } else if (isNewFile) {
            return false;
        }

        const originalContent = getOriginalFileContent(info, fileName);

        if (!originalContent) {
            return false;
        }

        // Comparing the content outside of code blocks also detects changes that end a code block early,
        // e.g. an inserted line within a Yaml block scalar that is not indented enough.
        const originalContentOutsideOfCode = getContentOutsideOfCodeBlocks(
            info,
            fileName,
            originalContent,
        );
        const modifiedContentOutsideOfCode = getContentOutsideOfCodeBlocks(
            info,
            fileName,
            applyTextChanges(originalContent, textChanges),
        );

        return (
            originalContentOutsideOfCode.length ==
                modifiedContentOutsideOfCode.length &&
            originalContentOutsideOfCode.every(
                (part, index) => part == modifiedContentOutsideOfCode[index],
            )
        );
    });
}

function getContentOutsideOfCodeBlocks(
    info: ts.server.PluginCreateInfo,
    fileName: string,
    fileContent: string,
) {
    const codeRanges = isBruFile(fileName)
        ? getCodeBlockIndizesForBruFile(fileContent)
              .map(({ startIndex, endIndex }) => ({
                  start: startIndex,
                  end: endIndex - 1, // index of the closing bracket
              }))
              .sort(({ start: start1 }, { start: start2 }) => start1 - start2)
        : isFileFromYamlCollection(info, fileName)
          ? getScriptContentRanges(fileContent)
          : [];

    return codeRanges
        .map(({ start }, index) =>
            fileContent.substring(
                index == 0 ? 0 : codeRanges[index - 1].end,
                start,
            ),
        )
        .concat(
            fileContent.substring(
                codeRanges.length > 0
                    ? codeRanges[codeRanges.length - 1].end
                    : 0,
            ),
        );
}

/**
 * The text changes for a file do not overlap and their spans refer to the original content.
 */
function applyTextChanges(
    fileContent: string,
    textChanges: readonly ts.TextChange[],
) {
    return [...textChanges]
        .sort(
            ({ span: { start: start1 } }, { span: { start: start2 } }) =>
                start2 - start1,
        )
        .reduce(
            (content, { span: { start, length }, newText }) =>
                content.substring(0, start) +
                newText +
                content.substring(start + length),
            fileContent,
        );
}
