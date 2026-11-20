import { describe, it, expect } from "@jest/globals";
import {
    getLineCommentEdits,
    LineCommentAction,
    LineCommentEdit,
} from "./getLineCommentEdits";

describe("getLineCommentEdits", () => {
    it("comments out all lines at the minimal indentation when toggling lines that are not all commented", () => {
        const lines = ["    if (a) {", "      // b();", "", "    }"];

        expect(
            applyEdits(
                lines,
                getLineCommentEdits(lines, LineCommentAction.Toggle, 0),
            ),
        ).toEqual(["    // if (a) {", "    //   // b();", "", "    // }"]);
    });

    it("removes the comments when toggling lines that are all commented", () => {
        const lines = ["    // if (a) {", "", "      //b();", "    // }"];

        expect(
            applyEdits(
                lines,
                getLineCommentEdits(lines, LineCommentAction.Toggle, 0),
            ),
        ).toEqual(["    if (a) {", "", "      b();", "    }"]);
    });

    it("always adds comments for the add action, even if lines are already commented", () => {
        const lines = ["  // a();", "  b();"];

        expect(
            applyEdits(
                lines,
                getLineCommentEdits(lines, LineCommentAction.Add, 0),
            ),
        ).toEqual(["  // // a();", "  // b();"]);
    });

    it("only removes comments from commented lines for the remove action", () => {
        const lines = ["  // a();", "  b();"];

        expect(
            applyEdits(
                lines,
                getLineCommentEdits(lines, LineCommentAction.Remove, 0),
            ),
        ).toEqual(["  a();", "  b();"]);
    });

    it("comments out lines that only contain whitespace if no other lines are given", () => {
        const lines = ["    "];

        expect(
            applyEdits(
                lines,
                getLineCommentEdits(lines, LineCommentAction.Toggle, 0),
            ),
        ).toEqual(["    // "]);
        expect(getLineCommentEdits(lines, LineCommentAction.Remove, 0)).toEqual(
            [],
        );
    });

    it("pads empty and short whitespace-only lines to the indentation of the surrounding block", () => {
        const lines = ["", "  ", "        "];

        expect(
            applyEdits(
                lines,
                getLineCommentEdits(lines, LineCommentAction.Toggle, 8),
            ),
        ).toEqual(["        // ", "        // ", "        // "]);
    });
});

function applyEdits(lines: string[], edits: LineCommentEdit[]) {
    return lines.map((text, index) => {
        const edit = edits.find(({ lineIndex }) => lineIndex == index);

        return edit
            ? `${text.substring(0, edit.character)}${edit.insertText}${text.substring(edit.character + edit.deleteCount)}`
            : text;
    });
}
