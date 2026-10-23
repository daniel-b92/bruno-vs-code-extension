import {
    getPathParamsFromUrl,
    HttpParamType,
    TextDocumentHelper,
} from "@global_shared";
import { TextEdit } from "vscode-languageserver";
import { applyParamChanges, ParamChanges } from "./editParamsEntries";
import { YamlUrlParamsInfo } from "./getYamlUrlParamsInfo";

/** Adds the path params from the URL that are missing in `params` and removes the enabled ones that are not part of the URL. */
export function updatePathParamsToMatchUrl(
    docHelper: TextDocumentHelper,
    info: YamlUrlParamsInfo,
): TextEdit[] {
    return applyParamChanges(docHelper, info, [getPathParamChanges(info)]);
}

export function getPathParamChanges({
    url,
    enabledPathParams,
}: YamlUrlParamsInfo): ParamChanges {
    const namesFromUrl = [...new Set(getPathParamsFromUrl(url.value))];
    const namesFromParams = enabledPathParams.map(({ name }) => name);

    return {
        remove: enabledPathParams
            .filter(({ name }) => !namesFromUrl.includes(name))
            .map(({ entry }) => entry),
        add: namesFromUrl
            .filter((name) => !namesFromParams.includes(name))
            .map((name) => ({ name, value: "", type: HttpParamType.Path })),
    };
}
