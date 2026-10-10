import { DictionaryBlock, isBlockDictionaryBlock } from "@global_shared";
import { parseBlocksFromRequestFileContent } from "@global_shared/_testingUtils";
import { checkAnnotationsAreValid } from "./checkAnnotationsAreValid";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

describe("checkAnnotationsAreValid", () => {
    it("does not report annotations placed before a simple field", () => {
        const blocks = getDictionaryBlocks(`headers {
  @description('a')
  key1: value1
}
`);

        expect(checkAnnotationsAreValid(blocks)).toHaveLength(0);
    });

    it("does not report annotations placed before a disabled field", () => {
        const blocks = getDictionaryBlocks(`headers {
  @description('a')
  key1: value1
  @description('b')
  ~key2: value2
}
`);

        expect(checkAnnotationsAreValid(blocks)).toHaveLength(0);
    });

    it("does not report one description and one type annotation before the same field", () => {
        const blocks = getDictionaryBlocks(`headers {
  @description('a')
  @contentType('text/plain')
  key1: value1
}
`);

        expect(checkAnnotationsAreValid(blocks)).toHaveLength(0);
    });

    it("reports an annotation without a following field with a defined range", () => {
        const blocks = getDictionaryBlocks(`headers {
  key1: value1
  @description('a')
}
`);

        const result = checkAnnotationsAreValid(blocks);

        expect(result).toHaveLength(1);
        expect(result[0].range).toBeDefined();
        expect(result[0].code).toBe(
            NonBlockSpecificDiagnosticCode.AnnotationBeforeNonSimpleFieldInDictionaryBlock,
        );
    });

    it("reports duplicate descriptions before the same field", () => {
        const blocks = getDictionaryBlocks(`headers {
  @description('a')
  @description('b')
  key1: value1
}
`);

        const result = checkAnnotationsAreValid(blocks);

        expect(result).toHaveLength(2);
        expect(result.map(({ code }) => code)).toEqual([
            NonBlockSpecificDiagnosticCode.DuplicateAnnotationOfSameSortInDictionaryBlock,
            NonBlockSpecificDiagnosticCode.DuplicateAnnotationOfSameSortInDictionaryBlock,
        ]);
    });

    it("reports an annotation before an array field", () => {
        const blocks = getDictionaryBlocks(`headers {
  @description('a')
  key1: [
    value1
  ]
}
`);

        const result = checkAnnotationsAreValid(blocks);

        expect(result).toHaveLength(1);
        expect(result[0].code).toBe(
            NonBlockSpecificDiagnosticCode.AnnotationBeforeNonSimpleFieldInDictionaryBlock,
        );
    });
});

function getDictionaryBlocks(text: string): DictionaryBlock[] {
    return parseBlocksFromRequestFileContent(text).filter(
        isBlockDictionaryBlock,
    );
}
