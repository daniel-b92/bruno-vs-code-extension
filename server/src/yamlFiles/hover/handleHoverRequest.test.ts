import { describe, it, expect } from "@jest/globals";
import {
    BrunoRequestFile,
    CollectionFormat,
    Position,
    TextDocumentHelper,
} from "@global_shared";
import {
    createCollectionWithEnvironments,
    createItemProviderStub,
} from "@global_shared/_testingUtils";
import { CancellationToken, Hover } from "vscode-languageserver";
import { TypedCollectionItemProvider } from "../../shared";
import { handleHoverRequest } from "./handleHoverRequest";

const requestPath = "/collection/request.yml";

describe("handleHoverRequest for yaml files", () => {
    it("shows the dynamic references for a variable that is read in a non-code section", () => {
        const text = `http:
  method: GET
  url: "{{dyn}}/path"
runtime:
  scripts:
    - type: before-request
      code: |
        bru.setVar("dyn", 1);
`;

        const result = hover(text, new Position(2, 12));

        expect(getHoverText(result)).toContain("Dynamic references");
        expect(getHoverText(result)).toContain("scripts[0]:before-request");
    });

    it("shows the static script variable references for a variable that is read in a script", () => {
        const text = `runtime:
  variables:
    - name: first
      value: "1"
  scripts:
    - type: before-request
      code: |
        bru.getRequestVar("first");
`;

        const result = hover(text, new Position(7, 28));

        expect(getHoverText(result)).toContain(
            "Static scripting variable references",
        );
    });

    it("returns no hover for a position without variable", () => {
        const text = `http:
  method: GET
  url: "{{first}}/path"
`;

        expect(hover(text, new Position(1, 4))).toBeUndefined();
    });

    it("returns no hover for variable-like text in sections without variable support", () => {
        const text = `info:
  name: "{{first}}"
  type: http
`;

        expect(hover(text, new Position(1, 12))).toBeUndefined();
    });

    it("shows the tag usages for a tag", () => {
        const text = `info:
  name: Foo
  type: http
  tags:
    - smoke
http:
  method: GET
  url: x
`;

        const result = hover(text, new Position(4, 8));

        expect(getHoverText(result)).toContain("No other usages found.");
    });
});

function hover(text: string, position: Position) {
    const collection = createCollectionWithEnvironments(
        [],
        CollectionFormat.Yaml,
    );
    collection.addItem({
        item: new BrunoRequestFile(requestPath),
        additionalData: undefined,
    });

    return handleHoverRequest({
        baseRequest: {
            filePath: requestPath,
            documentHelper: new TextDocumentHelper(text),
            position,
            token: CancellationToken.None,
        },
        collection,
        itemProvider: createItemProviderStub<TypedCollectionItemProvider>(
            collection.getRootDirectory(),
            CollectionFormat.Yaml,
            collection,
        ),
    });
}

function getHoverText(hover: Hover | undefined) {
    const { contents } = hover ?? {};
    return typeof contents == "string"
        ? contents
        : contents && "value" in contents
          ? contents.value
          : "";
}
