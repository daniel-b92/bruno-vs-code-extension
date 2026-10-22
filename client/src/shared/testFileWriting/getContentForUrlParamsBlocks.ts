import {
    getParamsFromUrl,
    LineBreakType,
    RequestFileBlockName,
} from "@global_shared";
import { getContentForDictionaryBlock } from "./internal/getContentForDictionaryBlock";

/**
 * Returns the `params:query` and `params:path` blocks that match the given URL (only for the params that are part of the URL).
 */
export function getContentForUrlParamsBlocks(
    filePath: string,
    url: string,
    lineBreak?: LineBreakType,
) {
    const { query, path } = getParamsFromUrl(url);

    return [
        { blockName: RequestFileBlockName.QueryParams, params: query },
        { blockName: RequestFileBlockName.PathParams, params: path },
    ]
        .filter(({ params }) => params.length > 0)
        .map(({ blockName, params }) =>
            getContentForDictionaryBlock(
                filePath,
                blockName,
                params.map(({ name, value }) => ({ key: name, value })),
                lineBreak,
            ),
        );
}
