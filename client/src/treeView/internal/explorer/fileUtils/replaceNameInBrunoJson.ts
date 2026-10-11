import { promisify } from "util";
import { readFile, writeFile } from "fs";
import { window } from "vscode";

export async function replaceNameInBrunoJson(
    filePath: string,
    newName: string,
) {
    const fileContent = await promisify(readFile)(filePath, "utf-8").catch(
        () => undefined,
    );

    if (fileContent === undefined) {
        return;
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(fileContent);
    } catch {
        return;
    }

    if (
        typeof parsed != "object" ||
        parsed === null ||
        Array.isArray(parsed) ||
        !("name" in parsed)
    ) {
        return;
    }

    const indentation = /^[ \t]+(?=")/m.exec(fileContent)?.[0] ?? "    ";
    const trailingNewline = fileContent.endsWith("\n") ? "\n" : "";

    await promisify(writeFile)(
        filePath,
        JSON.stringify({ ...parsed, name: newName }, undefined, indentation) +
            trailingNewline,
    ).catch(() => {
        window.showErrorMessage(
            `An unexpected error occured while replacing collection name.`,
        );
    });
}
