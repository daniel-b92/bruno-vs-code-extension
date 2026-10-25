import * as ts from "typescript/lib/tsserverlibrary";
import { CodeRange, getCodeRangesGetter } from "../codeBlocks/getCodeRanges";
import { isFileFromYamlCollection } from "../collection/collectionFormat";
import { isLineBreak } from "../codeBlocks/maskContent";
import { getOriginalFileContent } from "../fileContent";
import { hasEmbeddedCodeBlocks } from "../fileTypes";
import { getIndentationOfScripts } from "../yamlFiles/getIndentationOfScripts";

/**
 * Tabs are not allowed for indenting Yaml content.
 */
export function getFormatOptionsForFile(
    info: ts.server.PluginCreateInfo,
    fileName: string,
    formatOptions: ts.FormatCodeSettings,
): ts.FormatCodeSettings {
    return isFileFromYamlCollection(info, fileName)
        ? { ...formatOptions, convertTabsToSpaces: true }
        : formatOptions;
}

/**
 * The Typescript server indents the lines it inserts into scripts of Yaml files relative to the start of the wrapper function of the script,
 * which is always at the start of a line (see `maskYamlCollectionFileContent`). Such lines would end the Yaml block scalar of the script
 * (e.g. when extracting a constant), since they are indented less than the script.
 * To avoid this, the indentation of the scripts minus one indentation level for the wrapper function is added to the inserted lines.
 *
 * The range is the range that was requested from the Typescript server for the given file.
 */
export function adjustIndentationOfChangesForYamlScripts(
    info: ts.server.PluginCreateInfo,
    fileName: string,
    formatOptions: ts.FormatCodeSettings,
    range: { start: number; end: number },
    changes: readonly ts.FileTextChanges[],
): ts.FileTextChanges[] {
    const indentSize =
        formatOptions.indentSize ??
        ts.getDefaultFormatCodeSettings().indentSize!;

    return changes.map((fileChanges) => {
        const originalContent = isFileFromYamlCollection(
            info,
            fileChanges.fileName,
        )
            ? getOriginalFileContent(info, fileChanges.fileName)
            : undefined;
        const scriptIndentation = originalContent
            ? getIndentationOfScripts(
                  fileChanges.fileName,
                  originalContent,
                  fileChanges.fileName == fileName
                      ? range
                      : { start: 0, end: Number.MAX_SAFE_INTEGER },
              )
            : undefined;

        if (
            originalContent == undefined ||
            scriptIndentation == undefined ||
            scriptIndentation <= indentSize
        ) {
            return fileChanges;
        }

        const additionalIndentation = " ".repeat(
            scriptIndentation - indentSize,
        );

        return {
            ...fileChanges,
            textChanges: fileChanges.textChanges.map((textChange) => ({
                ...textChange,
                newText: indentInsertedLines(
                    textChange.newText,
                    additionalIndentation,
                    isAtStartOfLine(originalContent, textChange.span.start),
                ),
            })),
        };
    });
}

/**
 * Lines that are empty are not indented. The first line is only indented, if the text is inserted at the start of a line.
 */
function indentInsertedLines(
    text: string,
    indentation: string,
    isInsertedAtStartOfLine: boolean,
) {
    const lineBreak = /(\r\n|\r|\n|\u2028|\u2029)(?=[^\r\n\u2028\u2029])/g;
    const indentedText = text.replace(lineBreak, `$1${indentation}`);

    return isInsertedAtStartOfLine && text.length > 0 && !isLineBreak(text[0])
        ? indentation + indentedText
        : indentedText;
}

function isAtStartOfLine(content: string, index: number) {
    return index == 0 || isLineBreak(content[index - 1]);
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
