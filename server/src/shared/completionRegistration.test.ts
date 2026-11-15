import { describe, expect, it } from "@jest/globals";
import { DocumentSelector } from "vscode-languageserver/node";
import { COMPLETION_REGISTRATIONS } from "./completionRegistration";

describe("COMPLETION_REGISTRATIONS", () => {
    it("registers `$` as trigger character only for Bru and Yaml files", () => {
        expect(
            Object.fromEntries(
                COMPLETION_REGISTRATIONS.flatMap(
                    ({ documentSelector, triggerCharacters }) =>
                        (documentSelector ?? []).map((filter) => [
                            getLanguage(filter),
                            triggerCharacters?.includes("$"),
                        ]),
                ),
            ),
        ).toEqual({ bru: true, yaml: true, javascript: false });
    });

    it("does not register the same document selector more than once", () => {
        const selectors = COMPLETION_REGISTRATIONS.flatMap(
            ({ documentSelector }) =>
                (documentSelector ?? []).map((filter) =>
                    JSON.stringify(filter),
                ),
        );

        expect(new Set(selectors).size).toBe(selectors.length);
    });

    it("registers the same trigger characters for all file types, except for `$`", () => {
        const [first, ...others] = COMPLETION_REGISTRATIONS.map(
            ({ triggerCharacters }) =>
                (triggerCharacters ?? []).filter((char) => char != "$"),
        );

        others.forEach((characters) => expect(characters).toEqual(first));
    });
});

function getLanguage(filter: DocumentSelector[number]) {
    return typeof filter == "string" ? filter : filter.language;
}
