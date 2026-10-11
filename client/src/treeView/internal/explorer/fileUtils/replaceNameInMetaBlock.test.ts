import { describe, it, expect } from "@jest/globals";
import { readFile } from "fs/promises";
import { join } from "path";
import { parse } from "yaml";
import { BrunoFileType, CollectionFormat, ItemType } from "@global_shared";
import { useTemporaryDirectories } from "@global_shared/_testingUtils";
import { replaceNameInMetaBlock } from "./replaceNameInMetaBlock";

describe("replaceNameInMetaBlock", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it("replaces only the name in the meta block of a bru file", async () => {
        const content = getBruContent("old name");

        expect(
            await replaceInFile("request.bru", content, "new name", {
                format: CollectionFormat.Bru,
            }),
        ).toBe(content.replace("old name", "new name"));
    });

    it.each(["123", "true", "Get user #1", "a: b"])(
        "writes the name '%s' in a yaml file such that it is still parsed as the same string",
        async (newName) => {
            const result = await replaceInFile(
                "request.yml",
                getYamlContent("old"),
                newName,
            );

            expect(parseYamlName(result)).toBe(newName);
        },
    );

    it("does not quote simple names in a yaml file", async () => {
        const result = await replaceInFile(
            "request.yml",
            getYamlContent("old"),
            "new_name",
        );

        expect(result).toBe(getYamlContent("new_name"));
    });

    it("replaces a quoted name in a yaml file including the quotes", async () => {
        const result = await replaceInFile(
            "request.yml",
            getYamlContent('"old"'),
            "new",
        );

        expect(result).toBe(getYamlContent("new"));
    });

    it("keeps whitespace in front of a trailing comment in a yaml file", async () => {
        const result = await replaceInFile(
            "request.yml",
            getYamlContent("old name   # some comment"),
            "new",
        );

        expect(result).toBe(getYamlContent("new   # some comment"));
        expect(parseYamlName(result)).toBe("new");
    });

    async function replaceInFile(
        fileName: string,
        content: string,
        newName: string,
        {
            format = CollectionFormat.Yaml,
            itemType = BrunoFileType.RequestFile,
        }: { format?: CollectionFormat; itemType?: ItemType } = {},
    ) {
        const directory = await createTemporaryDirectory({
            [fileName]: content,
        });
        const filePath = join(directory, fileName);

        await replaceNameInMetaBlock(filePath, newName, itemType, format);

        return await readFile(filePath, "utf-8");
    }
});

function getBruContent(name: string) {
    return `meta {\n  name: ${name}\n  type: http\n  seq: 1\n}\n`;
}

function getYamlContent(nameValue: string) {
    return [
        "info:",
        `  name: ${nameValue}`,
        "  type: http",
        "  seq: 1",
        "",
        "http:",
        "  method: GET",
        '  url: ""',
        "",
    ].join("\n");
}

function parseYamlName(content: string) {
    return (parse(content) as { info: { name: unknown } }).info.name;
}
