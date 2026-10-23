export interface YamlParamDefinition {
    name: string;
    value: string;
    type: string;
    disabled?: boolean;
}

export function queryParam(
    name: string,
    value: string,
    disabled = false,
): YamlParamDefinition {
    return { name, value, type: "query", disabled };
}

export function pathParam(name: string, value = ""): YamlParamDefinition {
    return { name, value, type: "path", disabled: false };
}

/** Builds the content of a Yaml http request file. The `params` key is only included if there are any params. */
export function getYamlHttpRequestFile(
    url: string,
    params: YamlParamDefinition[] = [],
) {
    const paramLines = params.flatMap(({ name, value, type, disabled }) => [
        `    - name: ${name}`,
        `      value: ${JSON.stringify(value)}`,
        ...(disabled ? ["      disabled: true"] : []),
        `      type: ${type}`,
    ]);

    return [
        "info:",
        "  name: request",
        "  type: http",
        "  seq: 1",
        "",
        "http:",
        "  method: GET",
        `  url: ${url}`,
        ...(paramLines.length > 0 ? ["  params:", ...paramLines] : []),
        "",
    ].join("\n");
}
