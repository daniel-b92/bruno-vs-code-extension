import { promisify } from "util";
import { readFile, writeFile } from "fs";
import { window } from "vscode";
import { applyEdits, modify } from "jsonc-parser";

export async function replaceNameInBrunoJson(
    filePath: string,
    newName: string,
) {
    const fileContent = await promisify(readFile)(filePath, "utf-8").catch(
        () => undefined,
    );

    if (fileContent === undefined) {
        window.showErrorMessage(
            `An unexpected error occured while replacing collection name.`,
        );
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

    // Only the value is replaced, so that line breaks, indentation and any other formatting stay as they were.
    await promisify(writeFile)(
        filePath,
        applyEdits(fileContent, modify(fileContent, ["name"], newName, {})),
    ).catch(() => {
        window.showErrorMessage(
            `An unexpected error occured while replacing collection name.`,
        );
    });
}

