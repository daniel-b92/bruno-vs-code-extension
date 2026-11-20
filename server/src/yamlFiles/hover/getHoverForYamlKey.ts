import { YamlExpectedKeyInfo } from "@global_shared";
import { Hover, MarkupKind } from "vscode-languageserver";

export function getHoverForYamlKey(
    { key, isMandatory, valueKinds, allowedValues }: YamlExpectedKeyInfo,
    keyRange: Hover["range"],
): Hover {
    const lines = [
        `**${key}** (${isMandatory ? "mandatory" : "optional"})`,
        `Type: ${valueKinds.join(" | ")}`,
    ];

    if (allowedValues && allowedValues.length > 0) {
        lines.push(
            `Allowed values: ${allowedValues.map((v) => `\`${v}\``).join(", ")}`,
        );
    }

    return {
        contents: { kind: MarkupKind.Markdown, value: lines.join("\n\n") },
        range: keyRange,
    };
}
