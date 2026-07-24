import { Block, isDictionaryBlockField } from "../../../..";

export function getActiveKeysUsedInOtherLines(
    lineIndex: number,
    { content: blockContent }: Block,
) {
    return !Array.isArray(blockContent)
        ? []
        : blockContent
              .filter((field) => isDictionaryBlockField(field))
              .filter(
                  ({ keyRange: { start }, disabled }) =>
                      !disabled && start.line != lineIndex,
              )
              .map(({ key }) => key);
}
