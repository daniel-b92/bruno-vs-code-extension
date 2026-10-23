export enum ModifiedSide {
    Url,
    Params,
    BothOrNone,
}

export interface ParamsAccessors<T> {
    getUrl: (parsed: T) => string | undefined;
    /** Returns a string that is equal for URLs with equal params. */
    fromUrl: (url: string) => string;
    /** Returns a string that is equal for equal params, or `undefined` if they are invalid. */
    fromParams: (parsed: T) => string | undefined;
}

/**
 * Determines which side (URL or params definitions) was modified between the last save and now.
 * Only returns a single side, if exactly one of the two sides was modified.
 */
export function getModifiedSide<T>(
    lastSaved: T,
    current: T,
    { getUrl, fromUrl, fromParams }: ParamsAccessors<T>,
) {
    const lastSavedUrl = getUrl(lastSaved);
    const newUrl = getUrl(current);
    const lastSavedParams = fromParams(lastSaved);
    const newParams = fromParams(current);

    if (
        lastSavedUrl === undefined ||
        newUrl === undefined ||
        lastSavedParams === undefined ||
        newParams === undefined
    ) {
        return ModifiedSide.BothOrNone;
    }

    const urlModified = fromUrl(lastSavedUrl) != fromUrl(newUrl);
    const paramsModified = lastSavedParams != newParams;

    return urlModified == paramsModified
        ? ModifiedSide.BothOrNone
        : urlModified
          ? ModifiedSide.Url
          : ModifiedSide.Params;
}
