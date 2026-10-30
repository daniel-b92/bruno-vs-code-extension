import { describe, it, expect } from "@jest/globals";
import { maskBruFileContent } from "./maskBruFileContent";

describe("maskBruFileContent", () => {
    it("keeps the code of code blocks and replaces all other content by spaces", () => {
        const content = `meta {
  name: request
}

get {
  url: https://example.com/api/users/1
}

script:pre-request {
  const a = 1;
}
`;

        const maskedContent = maskBruFileContent(content);

        expect(getLineBreakIndizes(maskedContent)).toEqual(
            getLineBreakIndizes(content),
        );
        expect(maskedContent.length).toBe(content.length);
        expect(maskedContent).toContain("\n  const a = 1;\n}");
        expect(maskedContent).not.toMatch(/meta|name|request|get|url|https/);
    });

    it("wraps a code block in an arrow function, that shadows the objects which are not available", () => {
        const content = `get {
  url: https://example.com/api/users/1
}

script:pre-request {
  const a = 1;
}
`;

        // The Typescript server needs to see the wrapper function starting at the beginning of a line (see `placeTokens`).
        expect(maskBruFileContent(content).split("\n")).toEqual([
            blank("get {"),
            blank("  url: https://example.com/api/users/1"),
            blank("}"),
            "",
            ";$bU=async(  res)=>{",
            "  const a = 1;",
            "}",
            "",
        ]);
    });

    it("also shadows the unavailable objects for a code block that directly follows another one", () => {
        const content = `script:post-response {
  const a = 1;
}

script:pre-request {
  const b = 2;
}
`;

        expect(maskBruFileContent(content).split("\n")[4]).toBe(
            ";$bU=async(  res)=>{",
        );
    });

    it("wraps a code block without typed parameters if there are none for the block", () => {
        const content = `get {
  url: https://example.com/api/users/1
}

tests {
  const a = 1;
}
`;

        expect(maskBruFileContent(content).split("\n")).toEqual([
            blank("get {"),
            ";async(".padEnd("  url: https://example.com/api/users/1".length),
            blank("}"),
            "",
            ")=>{".padStart("tests {".length),
            "  const a = 1;",
            "}",
            "",
        ]);
    });

    it("wraps a code block in a function without the `async` keyword if there is not enough space for it", () => {
        const content = `script:pre-request {
  const a = 1;
}

tests {
  const b = 2;
}
`;

        const maskedLines = maskBruFileContent(content).split("\n");

        expect(maskedLines[4]).toBe(" ;()=>{");
        expect(maskedLines.slice(5, 7)).toEqual(["  const b = 2;", "}"]);
    });

    it("types the parameters depending on the block", () => {
        const content = `get {
  url: https://example.com/api/users/1
  body: none
  auth: none
}

script:post-response {
  const a = 1;
}
`;

        const maskedContent = maskBruFileContent(content);

        // `res` is not available before the request is sent, but `req` is available in all blocks.
        expect(maskedContent).not.toContain("$bU");
        expect(maskedContent).not.toMatch(/\b(req|res)\b/);
    });

    it("types the `bru` object and shadows `req` and `res` for gRPC requests", () => {
        const content = `meta {
  name: request
  type: grpc
}

grpc {
  url: localhost:50051
  method: /example.Greeter/SayHello
}

script:grpc:before-call-start {
  const a = 1;
}
`;

        expect(maskBruFileContent(content)).toMatch(
            /;\$gP=async\([\s\S]*\bbru,req,res\)=>\{/,
        );
    });

    it("also masks content that follows a code block", () => {
        const content = `script:pre-request {
  const a = 1;
}

docs {
  Some text
}
`;

        const maskedContent = maskBruFileContent(content);

        expect(maskedContent).not.toMatch(/docs|Some text/);
        expect(
            maskedContent.endsWith(
                `}\n\n${blank("docs {")}\n${blank("  Some text")}\n${blank("}")}\n`,
            ),
        ).toBe(true);
    });

    it("keeps the positions for files with Windows line endings", () => {
        const content =
            "meta {\r\n  name: request\r\n}\r\n\r\nscript:pre-request {\r\n  const a = 1;\r\n}\r\n";

        const maskedContent = maskBruFileContent(content);

        expect(getLineBreakIndizes(maskedContent)).toEqual(
            getLineBreakIndizes(content),
        );
        expect(maskedContent).toContain("\r\n  const a = 1;\r\n}\r\n");
    });

    it("closes the last code block if its closing bracket is missing", () => {
        const content = `script:pre-request {
  const a = 1;
`;

        // A line break is needed, since the closing bracket could otherwise be part of a line comment.
        expect(maskBruFileContent(content)).toBe(
            ";$bU=async(  res)=>{\n  const a = 1;\n\n}",
        );
    });

    it("returns only whitespace for files without code blocks", () => {
        const content = `meta {
  name: request
}
`;

        expect(maskBruFileContent(content).trim()).toBe("");
    });
});

function blank(text: string) {
    return " ".repeat(text.length);
}

function getLineBreakIndizes(text: string) {
    return [...text.matchAll(/\r|\n/g)].map(({ index }) => index);
}
