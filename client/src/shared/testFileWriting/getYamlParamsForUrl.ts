import {
    getParamsFromUrl,
    HttpParamType,
    RequestFileHttpSectionParamProperty,
} from "@global_shared";

/**
 * Returns the `params` property for the `http` section of a yaml request file that matches the given URL.
 * Is empty if the URL has no params.
 */
export function getYamlParamsForUrl(url: string) {
    const { query, path } = getParamsFromUrl(url);
    const params = [
        ...query.map((param) => ({ ...param, type: HttpParamType.Query })),
        ...path.map((param) => ({ ...param, type: HttpParamType.Path })),
    ].map(({ name, value, type }) => ({
        [RequestFileHttpSectionParamProperty.Name]: name,
        [RequestFileHttpSectionParamProperty.Value]: value,
        [RequestFileHttpSectionParamProperty.Type]: type,
    }));

    return params.length > 0 ? { params } : {};
}
