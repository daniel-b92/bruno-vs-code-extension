import { describe, it, expect } from "@jest/globals";
import {
    BrunoFolderSettingsFile,
    BrunoRequestFile,
    CollectionDirectory,
    CollectionItem,
    CollectionFormat,
    Position,
    TextDocumentHelper,
} from "@global_shared";
import { createCollectionWithItems } from "@global_shared/_testingUtils";
import { CancellationToken, Hover } from "vscode-languageserver";
import { TypedCollectionItemProvider } from "../../shared";
import { handleHoverRequest } from "./handleHoverRequest";

const requestPath = "/collection/request.yml";
const folderSettingsPath = "/collection/folder/folder.yml";

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

        expect(hover(text, new Position(1, 12))).toBeUndefined();
    });

    it("returns no hover for variable-like text in sections without variable support", () => {
        const text = `info:
  name: "{{first}}"
  type: http
`;

        expect(hover(text, new Position(1, 12))).toBeUndefined();
    });

    it("shows the expected type and allowed values for a key", () => {
        const text = `info:
  name: Foo
  type: http
`;

        const result = hover(text, new Position(2, 4));

        expect(getHoverText(result)).toContain("**type** (");
        expect(getHoverText(result)).toContain("Type: string");
        expect(getHoverText(result)).toContain("`http`");
    });

    it("returns no key hover for an unknown key", () => {
        const text = `http:
  method: GET
  foo: x
`;

        expect(hover(text, new Position(2, 3))).toBeUndefined();
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

    it("shows the tag usages for a tag in a folder settings file", () => {
        const text = `info:
  name: Folder
  type: folder
  tags:
    - smoke
`;

        const result = hover(text, new Position(4, 8), {
            filePath: folderSettingsPath,
            items: [
                new BrunoFolderSettingsFile(folderSettingsPath),
                new BrunoRequestFile("/collection/other.yml", 1, ["smoke"]),
            ],
        });

        expect(getHoverText(result)).toContain("1 other file");
    });

    it("does not show the folder's own tags as other usages", () => {
        const text = `info:
  name: Folder
  type: folder
  tags:
    - smoke
`;

        const result = hover(text, new Position(4, 8), {
            filePath: folderSettingsPath,
            items: [
                new BrunoFolderSettingsFile(folderSettingsPath),
                new CollectionDirectory(
                    "/collection/folder",
                    folderSettingsPath,
                    1,
                    ["smoke"],
                ),
            ],
        });

        expect(getHoverText(result)).toContain("No other usages found.");
    });
});

function hover(
    text: string,
    position: Position,
    {
        filePath = requestPath,
        items = [new BrunoRequestFile(requestPath)],
    }: { filePath?: string; items?: CollectionItem[] } = {},
) {
    const { collection, itemProvider } =
        createCollectionWithItems<TypedCollectionItemProvider>(
            items,
            CollectionFormat.Yaml,
        );

    return handleHoverRequest({
        baseRequest: {
            filePath,
            documentHelper: new TextDocumentHelper(text),
            position,
            token: CancellationToken.None,
        },
        collection,
        itemProvider,
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
