import { ParsedInfoWithTags } from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
import { CommonDiagnosticParams } from "../../interfaces";
import { checkCombinationOfPropertiesIsUnique } from "./generic/checkCombinationOfPropertiesIsUnique";

export function checkTagsAreUnique(
    info: ParsedInfoWithTags | undefined,
    { filePath }: CommonDiagnosticParams,
): (Diagnostic | undefined)[] {
    const tags = info?.properties.tags?.value ?? [];

    return checkCombinationOfPropertiesIsUnique(
        filePath,
        tags.map(({ value, range }) => ({ values: [value], range })),
        ["tag"],
    );
}
