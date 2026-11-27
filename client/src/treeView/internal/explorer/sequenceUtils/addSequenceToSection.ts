import { CollectionFormat } from "@global_shared";

/**
 * Adds the sequence to the `info` (Yaml) or `meta` (Bru) section of the content, which must not have a sequence yet.
 *
 * @returns Whether the content has such a section and the content with the added sequence.
 * The latter is `undefined` if there is no section or if the existing content has a structure that is not supported for adding the sequence.
 */
export function addSequenceToSection(
    content: string,
    sequence: number,
    format: CollectionFormat,
): { hasSection: boolean; contentWithSequence?: string } {
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const [sectionAnywhere, sectionStart] =
        format == CollectionFormat.Yaml
            ? ([/^info:/m, /^info:[ \t]*\r?\n/m] as const)
            : ([/^meta[ \t]*\{/m, /^meta[ \t]*\{[ \t]*\r?\n/m] as const);
    const match = sectionStart.exec(content);

    if (!match) {
        // The section may exist, but not in the usual multi-line notation (e.g. `info: {}`).
        return { hasSection: sectionAnywhere.test(content) };
    }

    const insertionIndex = match.index + match[0].length;

    if (hasSequenceKey(content.slice(insertionIndex))) {
        // There is a `seq` key, but its value is not a valid sequence. Adding a second one would make the file invalid.
        return { hasSection: true };
    }

    // The new line needs to use the same indentation as the existing properties of the section.
    const indentation =
        /^([ \t]+)\S/.exec(content.slice(insertionIndex))?.[1] ?? "  ";

    return {
        hasSection: true,
        contentWithSequence:
            content.slice(0, insertionIndex) +
            `${indentation}seq: ${sequence}${eol}` +
            content.slice(insertionIndex),
    };
}

/** Checks whether the section that starts at the beginning of the given content (up to the next non-indented line) contains a `seq` key. */
function hasSequenceKey(contentAfterSectionStart: string) {
    for (const line of contentAfterSectionStart.split(/\r?\n/)) {
        if (/^\S/.test(line)) {
            return false;
        }

        if (/^[ \t]+seq[ \t]*:/.test(line)) {
            return true;
        }
    }

    return false;
}
