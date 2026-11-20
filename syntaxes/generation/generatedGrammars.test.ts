import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "fs";
import { getContributedGrammars } from "../_testingUtils/contributedGrammars";
import {
    generatedGrammars,
    getGeneratedGrammarPath,
    serializeGrammar,
} from "./generatedGrammars";

describe("generated grammars", () => {
    it.each(generatedGrammars)(
        "'$fileName' is up to date (otherwise run 'npm run generate-syntaxes')",
        ({ fileName, create }) => {
            expect(
                readFileSync(getGeneratedGrammarPath(fileName), "utf8"),
            ).toEqual(serializeGrammar(create()));
        },
    );

    it.each(generatedGrammars)(
        "'$fileName' is contributed to yaml files in the 'package.json'",
        ({ fileName, create }) => {
            expect(getContributedGrammars()).toContainEqual(
                expect.objectContaining({
                    path: getGeneratedGrammarPath(fileName),
                    scopeName: create().scopeName,
                    injectTo: ["source.yaml"],
                }),
            );
        },
    );

    it("declares a VS Code language for all embedded languages in the 'package.json'", () => {
        const declaredScopes = new Set(
            getContributedGrammars().flatMap(({ embeddedLanguages }) =>
                Object.keys(embeddedLanguages ?? {}),
            ),
        );
        const usedScopes = new Set(
            generatedGrammars.flatMap(
                ({ create }) =>
                    JSON.stringify(create()).match(
                        /meta\.embedded\.block\.[\w-]+/g,
                    ) ?? [],
            ),
        );

        // SPARQL has no VS Code language.
        usedScopes.delete("meta.embedded.block.sparql");

        expect(
            [...usedScopes].filter((scope) => !declaredScopes.has(scope)),
        ).toEqual([]);
    });
});
