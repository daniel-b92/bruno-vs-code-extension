import { describe, it, expect } from "@jest/globals";
import { parseYamlEnvironmentFile } from "./parseYamlEnvironmentFile";
import { TextDocumentHelper } from "../../../fileSystem/textDocumentHelper";

describe("parseYamlEnvironmentFile", () => {
    it("parses a simple yaml environment file string", () => {
        const documentText = `name: Env1
variables:
  - name: var-1
    value: test-1
    description: desc`;
        const parsed = parseYamlEnvironmentFile(
            new TextDocumentHelper(documentText),
        );

        console.log(JSON.stringify(parsed, null, 2));

        expect(parsed).toEqual({
            name: "Env1",
            variables: [
                {
                    name: "var-1",
                    value: "test-1",
                    description: "desc",
                },
            ],
        });
    });
});
