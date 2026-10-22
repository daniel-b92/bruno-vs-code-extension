import {
    Block,
    BrunoFileType,
    doesRequestTypeSupportUrlParams,
    DictionaryBlock,
    getExpectedUrlQueryParamsForQueryParamsBlock,
    getPathParamsFromPathParamsBlock,
    getPathParamsFromUrl,
    getQueryParamsFromUrl,
    getRequestTypeField,
    getUrlFieldFromMethodBlock,
    getValidDictionaryBlocksWithName,
    isDictionaryBlockSimpleField,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "@global_shared";
import { TextEdit } from "vscode-languageserver";
import { updatePathParamsKeysToMatchUrl } from "../paramsBlocks/updatePathParamsKeysToMatchUrl";
import { updateQueryParamsBlockToMatchUrl } from "../paramsBlocks/updateQueryParamsBlockToMatchUrl";
import { updateUrlToMatchQueryParams } from "../paramsBlocks/updateUrlToMatchQueryParams";

/**
 * Syncs the URL and the params blocks of a request file when saving.
 * One side is only updated to match the other one, if exactly one of the two was modified since the last save.
 * If both sides were modified (or none), nothing is changed. The diagnostics and quick fixes can be used instead.
 *
 * @param lastSavedContent The content of the file before the current save (i.e. the content on disk).
 */
export function runUpdatesOnWillSave(
    lastSavedContent: string,
    newContent: string,
): TextEdit[] {
    const docHelper = new TextDocumentHelper(newContent);
    const { blocks } = parseBruFile(docHelper, BrunoFileType.RequestFile);
    const { blocks: lastSavedBlocks } = parseBruFile(
        new TextDocumentHelper(lastSavedContent),
        BrunoFileType.RequestFile,
    );

    if (!doesRequestTypeSupportUrlParams(getRequestTypeField(blocks)?.value)) {
        return [];
    }

    const edits: TextEdit[] = [];

    switch (getModifiedSide(lastSavedBlocks, blocks, queryParamsAccessors)) {
        case ModifiedSide.Url:
            edits.push(...updateQueryParamsBlockToMatchUrl(docHelper, blocks));
            break;
        case ModifiedSide.Block:
            edits.push(...[updateUrlToMatchQueryParams(blocks)].flat());
            break;
    }

    // The values of path params only exist in the params block, so only the block can be updated to match the URL.
    if (
        getModifiedSide(lastSavedBlocks, blocks, pathParamsAccessors) ==
        ModifiedSide.Url
    ) {
        edits.push(
            ...[updatePathParamsKeysToMatchUrl(docHelper, blocks)].flat(),
        );
    }

    return edits;
}

enum ModifiedSide {
    Url,
    Block,
    BothOrNone,
}

interface ParamsAccessors {
    /** Returns a string that is equal for URLs with equal params. */
    fromUrl: (url: string) => string;
    /** Returns a string that is equal for blocks with equal params, or `undefined` if the block(s) are invalid. */
    fromBlocks: (blocks: Block[]) => string | undefined;
}

const queryParamsAccessors: ParamsAccessors = {
    fromUrl: (url) => getQueryParamsFromUrl(url)?.toString() ?? "",
    fromBlocks: (blocks) =>
        getSingleBlockIfValid(
            blocks,
            RequestFileBlockName.QueryParams,
            ({ content }) => {
                const simpleFields = content.filter(
                    isDictionaryBlockSimpleField,
                );

                return simpleFields.length == content.length
                    ? getExpectedUrlQueryParamsForQueryParamsBlock(
                          simpleFields,
                      ).toString()
                    : undefined;
            },
        ),
};

const pathParamsAccessors: ParamsAccessors = {
    fromUrl: (url) => getPathParamsFromUrl(url).join("/"),
    fromBlocks: (blocks) =>
        getSingleBlockIfValid(
            blocks,
            RequestFileBlockName.PathParams,
            (block) => getPathParamsFromPathParamsBlock(block).join("/"),
        ),
};

function getModifiedSide(
    lastSavedBlocks: Block[],
    newBlocks: Block[],
    { fromUrl, fromBlocks }: ParamsAccessors,
) {
    const lastSavedUrl = getUrl(lastSavedBlocks);
    const newUrl = getUrl(newBlocks);
    const lastSavedBlock = fromBlocks(lastSavedBlocks);
    const newBlock = fromBlocks(newBlocks);

    if (
        lastSavedUrl === undefined ||
        newUrl === undefined ||
        lastSavedBlock === undefined ||
        newBlock === undefined
    ) {
        return ModifiedSide.BothOrNone;
    }

    const urlModified = fromUrl(lastSavedUrl) != fromUrl(newUrl);
    const blockModified = lastSavedBlock != newBlock;

    return urlModified == blockModified
        ? ModifiedSide.BothOrNone
        : urlModified
          ? ModifiedSide.Url
          : ModifiedSide.Block;
}

function getUrl(blocks: Block[]) {
    const urlField = getUrlFieldFromMethodBlock(blocks);

    return urlField &&
        !urlField.disabled &&
        isDictionaryBlockSimpleField(urlField)
        ? urlField.value
        : undefined;
}

/** A missing block counts as a block without entries. */
function getSingleBlockIfValid(
    blocks: Block[],
    blockName: RequestFileBlockName,
    getComparableString: (block: DictionaryBlock) => string | undefined,
) {
    const allBlocks = blocks.filter(({ name }) => name == blockName);
    const validBlocks = getValidDictionaryBlocksWithName(blocks, blockName);

    if (allBlocks.length == 0) {
        return "";
    }

    return allBlocks.length == 1 && validBlocks.length == 1
        ? getComparableString(validBlocks[0])
        : undefined;
}
