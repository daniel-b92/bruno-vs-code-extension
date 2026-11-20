import { Hover } from "vscode-languageserver";

/** Returns the text of the hover contents (or an empty string, if there is no hover). */
export function getHoverText(hover: Hover | undefined) {
    const { contents } = hover ?? {};
    return typeof contents == "string"
        ? contents
        : contents && "value" in contents
          ? contents.value
          : "";
}
