export function getPathParamsFromUrl(url: string) {
    const urlWithoutQueryParams =
        url.indexOf("?") > 0
            ? url.split("?")[0]
            : url.startsWith("?")
            ? ""
            : url;

    return urlWithoutQueryParams.includes("/")
        ? urlWithoutQueryParams
              .substring(urlWithoutQueryParams.indexOf("/"))
              .split("/")
              .filter((subPath) => subPath.startsWith(":"))
              .map((subPath) => subPath.substring(1))
        : [];
}
