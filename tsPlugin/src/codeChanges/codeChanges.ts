import * as ts from "typescript/lib/tsserverlibrary";
import { CodeRange, getCodeRangesGetter } from "../codeBlocks/getCodeRanges";
import { isFileFromYamlCollection } from "../collection/collectionFormat";
import { getOriginalFileContent } from "../fileContent";
import { hasEmbeddedCodeBlocks } from "../fileTypes";
import { getIndentationOfScripts } from "../yamlFiles/getIndentationOfScripts";

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
        ? getIndentationOfScripts(fileName, originalContent, range)
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

interface OriginalFile {
    content: string;
    contentOutsideOfCode: string[];
    getCodeRanges: (fileContent: string) => CodeRange[];
}

/**
 * Returns a function that checks whether the given changes only modify the code within code blocks, if they affect '.bru' or '.yml' files.
 *
 * The returned function determines the data for the original content of each file only once,
 * since the changes of many code fixes usually affect the same file.
 */
export function createCheckForChangesWithinCodeBlocks(
    info: ts.server.PluginCreateInfo,
) {
    const originalFiles = new Map<string, OriginalFile | undefined>();

    return (changes: readonly ts.FileTextChanges[]) =>
        changes.every(({ fileName, textChanges, isNewFile }) => {
            if (!hasEmbeddedCodeBlocks(fileName)) {
                return true;
            } else if (isNewFile) {
                return false;
            }

            if (!originalFiles.has(fileName)) {
                originalFiles.set(fileName, getOriginalFile(info, fileName));
            }

            const originalFile = originalFiles.get(fileName);

            if (!originalFile) {
                return false;
            }

            const { content, contentOutsideOfCode, getCodeRanges } =
                originalFile;
            const modifiedContent = applyTextChanges(content, textChanges);

            // Comparing the content outside of code blocks also detects changes that end a code block early,
            // e.g. an inserted line within a Yaml block scalar that is not indented enough.
            const modifiedContentOutsideOfCode = getContentOutsideOfCodeRanges(
                modifiedContent,
                getCodeRanges(modifiedContent),
            );

            return (
                contentOutsideOfCode.length ==
                    modifiedContentOutsideOfCode.length &&
                contentOutsideOfCode.every(
                    (part, index) =>
                        part == modifiedContentOutsideOfCode[index],
                )
            );
        });
}

function getOriginalFile(
    info: ts.server.PluginCreateInfo,
    fileName: string,
): OriginalFile | undefined {
    const content = getOriginalFileContent(info, fileName);

    if (!content) {
        return undefined;
    }

    const getCodeRanges = getCodeRangesGetter(info, fileName);

    return {
        content,
        contentOutsideOfCode: getContentOutsideOfCodeRanges(
            content,
            getCodeRanges(content),
        ),
        getCodeRanges,
    };
}

function getContentOutsideOfCodeRanges(
    fileContent: string,
    codeRanges: CodeRange[],
) {
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
