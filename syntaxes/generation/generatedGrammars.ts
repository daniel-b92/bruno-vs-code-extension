import { resolve } from "path";
import {
    createYamlBodiesInjectionGrammar,
    yamlBodiesInjectionFileName,
} from "./yamlBodiesInjection";
import { InjectionGrammar } from "./yamlRuleBuilders";

export const generatedGrammars: {
    fileName: string;
    create: () => InjectionGrammar;
}[] = [
    {
        fileName: yamlBodiesInjectionFileName,
        create: createYamlBodiesInjectionGrammar,
    },
];

export function getGeneratedGrammarPath(fileName: string) {
    return resolve(__dirname, "..", fileName);
}

export function serializeGrammar(grammar: InjectionGrammar) {
    return `${JSON.stringify(grammar, null, 4)}\n`;
}
