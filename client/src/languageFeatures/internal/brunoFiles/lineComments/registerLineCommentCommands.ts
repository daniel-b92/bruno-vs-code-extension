import {
    commands,
    Range,
    Selection,
    TextDocument,
    TextEditor,
    TextEditorEdit,
} from "vscode";
import {
    CollectionFormat,
    getBlocksWithoutLineCommentsFromYamlFile,
    getJsCodeBlocksFromFile,
} from "@global_shared";
import { mapToVsCodeRange, TypedCollectionItemProvider } from "@shared";
import { getLineCommentEdits, LineCommentAction } from "./getLineCommentEdits";

/**
 * For code blocks within Yaml files, the inbuilt commands for line comments use the comment syntax for Yaml (`#`), since VS Code determines
 * the language via the token at the start of the first selected line, which is always the Yaml indentation.
 * The registered commands use Javascript line comments within code blocks instead. Within blocks of languages without line comments (JSON, XML, HTML, Markdown), they do nothing.
 * Otherwise, they fall back to the inbuilt commands.
 */
export function registerLineCommentCommands(
    itemProvider: TypedCollectionItemProvider,
) {
    return [
        {
            command: "bruAsCode.toggleLineComment",
            action: LineCommentAction.Toggle,
            fallbackCommand: "editor.action.commentLine",
        },
        {
            command: "bruAsCode.addLineComment",
            action: LineCommentAction.Add,
            fallbackCommand: "editor.action.addCommentLine",
        },
        {
            command: "bruAsCode.removeLineComment",
            action: LineCommentAction.Remove,
            fallbackCommand: "editor.action.removeCommentLine",
        },
    ].map(({ command, action, fallbackCommand }) =>
        commands.registerTextEditorCommand(command, (editor, editBuilder) => {
            if (
                !handleLineCommentsInCodeBlocks(
                    itemProvider,
                    editor,
                    editBuilder,
                    action,
                )
            ) {
                void Promise.resolve(
                    commands.executeCommand(fallbackCommand),
                ).catch((error) =>
                    console.error(
                        `Fallback command '${fallbackCommand}' failed`,
                        error,
                    ),
                );
            }
        }),
    );
}

/**
 * @returns whether the command was handled. This is the case if all selections are within code blocks of a Yaml file (then, the edits are applied)
 * or if any selection overlaps with a block without line comments (then, nothing is done).
 */
function handleLineCommentsInCodeBlocks(
    itemProvider: TypedCollectionItemProvider,
    { document, selections }: TextEditor,
    editBuilder: TextEditorEdit,
    action: LineCommentAction,
) {
    const collection = itemProvider.getAncestorCollectionForPath(
        document.fileName,
    );
    const itemType = collection
        ?.getStoredDataForPath(document.fileName)
        ?.item.getItemType();

    if (
        !collection ||
        !itemType ||
        collection.getFormat() != CollectionFormat.Yaml
    ) {
        return false;
    }

    const codeBlockRanges = getJsCodeBlocksFromFile(
        document.getText(),
        itemType,
        collection.getFormat(),
    ).blocks.map(({ contentRange }) => mapToVsCodeRange(contentRange));

    const selectedLineRanges = selections.map(getSelectedLineRange);

    if (
        !selectedLineRanges.every(({ firstLine, lastLine }) =>
            codeBlockRanges.some(
                ({ start, end }) =>
                    start.line <= firstLine && lastLine <= end.line,
            ),
        )
    ) {
        // Inserting `#` would change the content of blocks with languages that do not support line comments (e.g. a request body), so nothing is done for those.
        return getBlocksWithoutLineCommentsFromYamlFile(document.getText())
            .map(mapToVsCodeRange)
            .some(({ start, end }) =>
                selectedLineRanges.some(
                    ({ firstLine, lastLine }) =>
                        firstLine <= end.line && start.line <= lastLine,
                ),
            );
    }

    const handledLines = new Set<number>();

    for (const { firstLine, lastLine } of selectedLineRanges) {
        const lineNumbers = Array.from(
            { length: lastLine - firstLine + 1 },
            (_, index) => firstLine + index,
        ).filter((line) => !handledLines.has(line));

        for (const {
            lineIndex,
            character,
            deleteCount,
            insertText,
        } of getLineCommentEdits(
            lineNumbers.map((line) => document.lineAt(line).text),
            action,
            getBlockIndentation(document, codeBlockRanges, firstLine),
        )) {
            const line = lineNumbers[lineIndex];

            editBuilder.replace(
                new Range(line, character, line, character + deleteCount),
                insertText,
            );
        }

        lineNumbers.forEach((line) => handledLines.add(line));
    }

    return true;
}

/**
 * @returns the minimal indentation of the non-blank lines of the code block that contains the given line.
 */
function getBlockIndentation(
    document: TextDocument,
    codeBlockRanges: Range[],
    line: number,
) {
    const block = codeBlockRanges.find(
        ({ start, end }) => start.line <= line && line <= end.line,
    );

    if (!block) {
        return 0;
    }

    const indentations = Array.from(
        { length: block.end.line - block.start.line + 1 },
        (_, index) => document.lineAt(block.start.line + index).text,
    )
        .filter((text) => text.trim().length > 0)
        .map((text) => text.length - text.trimStart().length);

    return indentations.length > 0 ? Math.min(...indentations) : 0;
}

function getSelectedLineRange({ start, end }: Selection) {
    return {
        firstLine: start.line,
        // Like for the inbuilt commands, a line is not included if the selection only ends at its start.
        lastLine:
            end.line > start.line && end.character == 0
                ? end.line - 1
                : end.line,
    };
}
