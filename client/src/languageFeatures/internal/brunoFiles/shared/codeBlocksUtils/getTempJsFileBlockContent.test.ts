import { describe, it, expect } from "@jest/globals";
import { getTempJsContentForRequestFile as getTempJsContent } from "../../../../../testUtils/getTempJsContent";
import { getTempJsFileBlockContent } from "./getTempJsFileBlockContent";

describe("getTempJsFileBlockContent", () => {
    it("finds the content of each code block in the generated temp js file", () => {
        const tempJsContent = getTempJsContent(`meta {
  name: test
  type: grpc
}

script:grpc:before-call-start {
  bru.setVar("a", 1);
}

script:grpc:before-message-send {
  const x = { y: 1 };
  await Promise.resolve(x);
}
`);

        expect(
            getTempJsFileBlockContent(
                tempJsContent,
                "script:grpc:before-call-start",
            )?.content,
        ).toBe('  bru.setVar("a", 1);\n');
        expect(
            getTempJsFileBlockContent(
                tempJsContent,
                "script:grpc:before-message-send",
            )?.content,
        ).toBe("  const x = { y: 1 };\n  await Promise.resolve(x);\n");
    });

    it("returns undefined for blocks that are not part of the temp js file", () => {
        const tempJsContent = getTempJsContent(
            "meta {\n  name: test\n  type: grpc\n}\n\ntests {\n  asd\n}\n",
        );

        expect(
            getTempJsFileBlockContent(tempJsContent, "script:pre-request"),
        ).toBeUndefined();
    });

    it("ends the block at the closing bracket, even if the following line could continue the expression", () => {
        const tempJsContent = getTempJsContent(
            "meta {\n  name: test\n  type: grpc\n}\n\nscript:pre-request {\n  foo();\n}\n(bar)\n}\n",
        );

        expect(
            getTempJsFileBlockContent(tempJsContent, "script:pre-request")
                ?.content,
        ).toBe("  foo();\n");
    });

    it("ignores other top-level statements that are not the wrapper function", () => {
        const tempJsContent = getTempJsContent(
            "meta {\n  name: test\n  type: grpc\n}\n\nscript:pre-request {\n  foo();\n  }\n  bar();\n}\n",
        );

        expect(
            getTempJsFileBlockContent(tempJsContent, "script:pre-request")
                ?.content,
        ).toBe("  foo();\n  ");
    });
});
