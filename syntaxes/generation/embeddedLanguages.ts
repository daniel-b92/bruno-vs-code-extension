import { EmbeddedLanguage } from "./yamlRuleBuilders";

export const embeddedLanguages = {
    javascript: { scopeSuffix: "javascript", grammarScope: "source.js" },
    json: { scopeSuffix: "json", grammarScope: "source.json" },
    xml: { scopeSuffix: "xml", grammarScope: "text.xml" },
    sparql: { scopeSuffix: "sparql", grammarScope: "source.sparql" },
    html: { scopeSuffix: "html", grammarScope: "text.html.basic" },
    markdown: { scopeSuffix: "markdown", grammarScope: "text.html.markdown" },
    graphql: { scopeSuffix: "graphql", grammarScope: "source.graphql.bru" },
} satisfies Record<string, EmbeddedLanguage>;
