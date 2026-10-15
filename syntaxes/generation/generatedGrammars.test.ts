import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "fs";
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
});
