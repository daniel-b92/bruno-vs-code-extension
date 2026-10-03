import { HttpBodyType, ParsedRequestFile } from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
import { checkJsonSyntax } from "../../../../shared";

export function checkJsonBodySyntax(
    body: NonNullable<
        ParsedRequestFile["properties"]["http"]
    >["properties"]["body"],
): Diagnostic | undefined {
    const { type, data } = body?.properties ?? {};

    if (type?.value != HttpBodyType.Json || !data) {
        return undefined;
    }

    return checkJsonSyntax(
        { content: data.value, contentRange: data.valueRange },
        // The content in the yaml document may differ from the actual content (e.g. due to indentation or escaping).
        false,
    )?.diagnostic;
}
