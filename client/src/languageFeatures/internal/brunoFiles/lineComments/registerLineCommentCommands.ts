import { commands, Range, Selection, TextEditor, TextEditorEdit } from "vscode";
import { CollectionFormat, getJsCodeBlocksFromFile } from "@global_shared";
import { mapToVsCodeRange, TypedCollectionItemProvider } from "@shared";
import { getLineCommentEdits, LineCommentAction } from "./getLineCommentEdits";

/**
 * For code blocks within Yaml files, the inbuilt commands for line comments use the comment syntax for Yaml (`#`), since VS Code determines
 * the language via the token at the start of the first selected line, which is always the Yaml indentation.
 * The registered commands use Javascript line comments within code blocks instead and fall back to the inbuilt commands otherwise.
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
                !applyJsLineCommentsInCodeBlocks(
                    itemProvider,
                    editor,
                    editBuilder,
                    action,
                )
            ) {
                commands.executeCommand(fallbackCommand);
            }
        }),
    );
}

/**
 * @returns whether the edits were applied. This is only the case if all selections are within code blocks of a Yaml file.
 */
function applyJsLineCommentsInCodeBlocks(
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
        return false;
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
