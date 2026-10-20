import { TextDocumentHelper } from "../../..";

const DEFAULT_INDENTATION_STEP = 2;

/**
 * Returns the number of spaces by which nested Yaml content is indented within the document.
 * It is determined from the first indented line, since that one is nested directly within a top level key.
 * Defaults to 2 spaces, if the document does not have any indented lines yet.
 */
export function getYamlIndentationStep(docHelper: TextDocumentHelper) {
    const firstIndentedLine = docHelper
        .getAllLines()
        .map(({ content }) => content)
        .find((content) => /^ +[^\s#]/.test(content));

    return firstIndentedLine
        ? firstIndentedLine.length - firstIndentedLine.trimStart().length
        : DEFAULT_INDENTATION_STEP;
}
