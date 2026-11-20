export enum LineCommentAction {
    Toggle = "toggle",
    Add = "add",
    Remove = "remove",
}

export interface LineCommentEdit {
    /** The index of the line within the given lines. */
    lineIndex: number;
    character: number;
    deleteCount: number;
    insertText: string;
}

const commentToken = "//";

/**
 * Determines the edits for adding or removing Javascript line comments for the given lines, similar to the inbuilt VS Code commands.
 * Lines that only contain whitespace are ignored, unless all given lines only contain whitespace.
 * In that case, the comments are inserted at least at the given indentation of the surrounding block, since less indented lines would end a Yaml block scalar.
 */
export function getLineCommentEdits(
    lines: string[],
    action: LineCommentAction,
    blockIndentation: number,
): LineCommentEdit[] {
    const nonBlankLines = lines
        .map((text, lineIndex) => ({
            text,
            lineIndex,
            indentation: getIndentationLength(text),
        }))
        .filter(({ text }) => text.trim().length > 0);

    if (nonBlankLines.length == 0) {
        return action == LineCommentAction.Remove
            ? []
            : lines.map((text, lineIndex) => ({
                  lineIndex,
                  character: text.length,
                  deleteCount: 0,
                  insertText: `${" ".repeat(Math.max(0, blockIndentation - text.length))}${commentToken} `,
              }));
    }

    const shouldRemove =
        action == LineCommentAction.Remove ||
        (action == LineCommentAction.Toggle &&
            nonBlankLines.every(isCommented));

    if (shouldRemove) {
        return nonBlankLines
            .filter(isCommented)
            .map(({ text, lineIndex, indentation }) => ({
                lineIndex,
                character: indentation,
                deleteCount:
                    commentToken.length +
                    (text.charAt(indentation + commentToken.length) == " "
                        ? 1
                        : 0),
                insertText: "",
            }));
    }

    const minIndentation = Math.min(
        ...nonBlankLines.map(({ indentation }) => indentation),
    );

    return nonBlankLines.map(({ lineIndex }) => ({
        lineIndex,
        character: minIndentation,
        deleteCount: 0,
        insertText: `${commentToken} `,
    }));
}

function isCommented({
    text,
    indentation,
}: {
    text: string;
    indentation: number;
}) {
    return text.startsWith(commentToken, indentation);
}

function getIndentationLength(text: string) {
    return text.length - text.trimStart().length;
}
