/** Escapes the characters that have a special meaning within a snippet choice (e.g. `${1|a,b|}`). */
export function escapeSnippetChoiceOption(option: string): string {
    return option.replace(/[\\,|]/g, (match) => `\\${match}`);
}
