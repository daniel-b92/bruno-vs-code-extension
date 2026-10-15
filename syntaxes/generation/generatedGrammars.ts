import { resolve } from "path";
import { yamlBodiesInjection } from "./yamlBodiesInjection";
import {
    yamlAppInjection,
    yamlDocsInjection,
    yamlScriptsInjection,
} from "./yamlSectionContentInjections";
import { yamlSectionsInjection } from "./yamlSectionsInjection";
import { GeneratedGrammar, InjectionGrammar } from "./yamlRuleBuilders";

export const generatedGrammars: GeneratedGrammar[] = [
    yamlSectionsInjection,
    yamlScriptsInjection,
    yamlBodiesInjection,
    yamlDocsInjection,
    yamlAppInjection,
];

export function getGeneratedGrammarPath(fileName: string) {
    return resolve(__dirname, "..", fileName);
}

export function serializeGrammar(grammar: InjectionGrammar) {
    return `${JSON.stringify(grammar, null, 4)}\n`;
}
