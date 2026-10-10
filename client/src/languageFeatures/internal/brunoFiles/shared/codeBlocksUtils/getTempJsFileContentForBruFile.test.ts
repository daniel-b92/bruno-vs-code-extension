import { describe, it, expect } from "@jest/globals";
import { getTempJsContentForRequestFile } from "../../../../../testUtils/getTempJsContent";

describe("getTempJsFileContentForBruFile", () => {
    it("only includes `bru` (with `grpc`) for GRPC requests", () => {
        const content = getContentForRequestOfType("grpc");

        expect(content).toContain("const bru = {");
        expect(content).toContain("grpc: {");
        expect(content).not.toContain("const req =");
        expect(content).not.toContain("const res =");
    });

    it.each(["http", "graphql"])(
        "includes `req` and `res` but no `bru.grpc` for %s requests",
        (type) => {
            const content = getContentForRequestOfType(type);

            expect(content).toContain("const bru = {");
            expect(content).toContain("const req =");
            expect(content).toContain("const res =");
            expect(content).not.toContain("grpc: {");
        },
    );

    it("restricts `bru.grpc` to `request` / `response` depending on the execution group", () => {
        const content = getTempJsContentForRequestFile(
            `meta {
  name: test
  type: grpc
}

script:grpc:before-call-start {
  bru.setVar("a", 1);
}

script:grpc:after-call-end {
  bru.setVar("a", 1);
}
`,
        );

        expect(content).toMatch(
            /\/\* script:grpc:before-call-start \*\/ void async function \(\/\*\* @type \{BruForPreRequestGrpc\} \*\/ bru\) \{/,
        );
        expect(content).toMatch(
            /\/\* script:grpc:after-call-end \*\/ void async function \(\/\*\* @type \{BruForPostResponseGrpc\} \*\/ bru\) \{/,
        );
    });

    it("hides `res` in pre-request blocks and `req` in post-response blocks for http requests", () => {
        const content = getTempJsContentForRequestFile(
            `meta {
  name: test
  type: http
}

script:pre-request {
  req.getUrl();
}

script:post-response {
  res.getStatus();
}

tests {
  req.getUrl();
}
`,
        );

        expect(content).toMatch(
            /\/\* script:pre-request \*\/ void async function \(\/\*\* @type \{undefined\} \*\/ res\) \{/,
        );
        expect(content).toMatch(
            /\/\* script:post-response \*\/ void async function \(\/\*\* @type \{undefined\} \*\/ req\) \{/,
        );
        expect(content).toMatch(/\/\* tests \*\/ void async function \(\) \{/);
    });

    it("includes all definitions if the request type is unknown", () => {
        const content = getTempJsContentForRequestFile(
            "meta {\n  name: test\n}\n",
        );

        expect(content).toContain("grpc: {");
        expect(content).toContain("const req =");
        expect(content).toContain("const res =");
    });

    it("does not introduce any bindings for the block names in the module scope", () => {
        const content = getTempJsContentForRequestFile(
            "meta {\n  name: test\n  type: http\n}\n\nscript:pre-request {\n  a\n}\n\nscript:post-response {\n  a\n}\n\ntests {\n  a\n}\n",
        );

        expect(content).not.toMatch(
            /^\s*(async\s+)?function\s+\w+\s*\(|^\s*(const|let|var)\s+(script_\w+|tests)\b/m,
        );
    });
});

function getContentForRequestOfType(type: string) {
    return getTempJsContentForRequestFile(
        `meta {\n  name: test\n  type: ${type}\n}\n`,
    );
}
