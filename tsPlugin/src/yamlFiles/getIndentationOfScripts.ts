import { getScriptContentRanges } from "./maskYamlFileContent";

/**
 * Returns the indentation of the scripts that overlap with the given range, if all of them use the same indentation.
 *
 * The indentation of a literal block scalar is the minimal indentation of its non-empty lines.
 * Lines with this indentation are always part of the block scalar, even if it uses an explicit indentation indicator (e.g. `code: |2-`).
 */
export function getIndentationOfScripts(
    fileContent: string,
    range: { start: number; end: number },
) {
    const indentations = new Set(
        getScriptContentRanges(fileContent)
            .filter(
                ({ start, end }) => start <= range.end && range.start <= end,
            )
            .map(({ start, end }) =>
                getMinimalIndentation(fileContent.substring(start, end)),
            ),
    );

    return indentations.size == 1 ? [...indentations][0] : undefined;
}

function getMinimalIndentation(scriptContent: string) {
    const indentations = scriptContent
        .split(/\r\n|\r|\n|\u2028|\u2029/)
        .filter((line) => line.trim().length > 0)
        .map((line) => /^ */.exec(line)![0].length);

    return indentations.length > 0 ? Math.min(...indentations) : undefined;
}
