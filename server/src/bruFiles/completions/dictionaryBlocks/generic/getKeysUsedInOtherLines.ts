import { Block, isDictionaryBlockField } from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";

export function getKeysUsedInOtherLines(
    { position: { line } }: LanguageFeatureBaseRequest,
    { content: blockContent }: Block,
) {
    return !Array.isArray(blockContent)
        ? []
        : blockContent
              .filter((field) => isDictionaryBlockField(field))
              .filter(({ keyRange: { start } }) => start.line != line)
              .map(({ key }) => key);
}
