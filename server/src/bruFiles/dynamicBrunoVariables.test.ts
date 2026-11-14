import { describe, it, expect } from "@jest/globals";
import {
    BrunoRequestFile,
    CollectionFormat,
    Position,
    TextDocumentHelper,
} from "@global_shared";
import { createCollectionWithItems } from "@global_shared/_testingUtils";
import { CancellationToken, Hover } from "vscode-languageserver";
import { TypedCollectionItemProvider } from "../shared";
import { handleCompletionRequest } from "./completions/handleCompletionRequest";
import { handleHoverRequest } from "./hover/handleHoverRequest";

const requestPath = "/collection/request.bru";

describe("dynamic Bruno variables in bru files", () => {
    it("suggests the dynamic variables when `{{$` is typed in the url", async () => {
        const result = await complete(
            `get {
  url: https://api.example.com/users/{{$ra
}
`,
            new Position(1, 42),
        );

        expect(result?.map(({ label }) => label)).toContain("$randomInt");
        expect(
            result?.find(({ label }) => label == "$randomInt")?.labelDetails
                ?.description,
        ).toBe("A random integer between 0 and 1000");
    });

    it("does not suggest the dynamic variables when only `{{` is typed", async () => {
        const result = await complete(
            `get {
  url: https://api.example.com/users/{{
}
`,
            new Position(1, 39),
        );

        expect(
            (result ?? []).filter(({ label }) => label.startsWith("$")),
        ).toEqual([]);
    });

    it("shows the description and an example for a dynamic variable in the headers", () => {
        const result = hover(
            `headers {
  X-Request-Id: {{$guid}}
}
`,
            new Position(1, 20),
        );

        expect(getHoverText(result)).toBe(
            "A random UUID. Example: `550e8400-e29b-41d4-a716-446655440000`",
        );
    });

    it("shows no hover for an unknown name starting with `$`", () => {
        const result = hover(
            `headers {
  X-Request-Id: {{$guids}}
}
`,
            new Position(1, 20),
        );

        expect(result).toBeUndefined();
    });
});

function getRequest(text: string, position: Position) {
    const { collection, itemProvider } =
        createCollectionWithItems<TypedCollectionItemProvider>(
            [new BrunoRequestFile(requestPath)],
            CollectionFormat.Bru,
        );

    return {
        baseRequest: {
            filePath: requestPath,
            documentHelper: new TextDocumentHelper(text),
            position,
            token: CancellationToken.None,
        },
        collection,
        itemProvider,
    };
}

function complete(text: string, position: Position) {
    return handleCompletionRequest(getRequest(text, position));
}

function hover(text: string, position: Position) {
    return handleHoverRequest(getRequest(text, position));
}

function getHoverText(hover: Hover | undefined) {
    const { contents } = hover ?? {};
    return typeof contents == "string"
        ? contents
        : contents && "value" in contents
          ? contents.value
          : "";
}
