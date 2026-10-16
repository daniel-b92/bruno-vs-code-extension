import { writeFileSync } from "fs";
import {
    generatedGrammars,
    getGeneratedGrammarPath,
    serializeGrammar,
} from "./generatedGrammars";

for (const { fileName, create } of generatedGrammars) {
    writeFileSync(
        getGeneratedGrammarPath(fileName),
        serializeGrammar(create()),
    );
}
