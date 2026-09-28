export function wrapInCodeSpan(content: string) {
    const longestBacktickRun = Math.max(
        0,
        ...(content.match(/`+/g) ?? []).map((run) => run.length),
    );
    const fence = "`".repeat(longestBacktickRun + 1);
    const needsPadding = content.startsWith("`") || content.endsWith("`");
    const paddedContent = needsPadding ? ` ${content} ` : content;

    return `${fence}${paddedContent}${fence}`;
}
