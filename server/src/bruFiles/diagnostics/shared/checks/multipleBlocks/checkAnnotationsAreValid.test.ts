import {
    BrunoFileType,
    DictionaryBlock,
    isBlockDictionaryBlock,
    parseBruFile,
    TextDocumentHelper,
} from "@global_shared";
import { checkAnnotationsAreValid } from "./checkAnnotationsAreValid";

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

    it("reports an annotation without a following field with a defined range", () => {
        const blocks = getDictionaryBlocks(`headers {
  key1: value1
  @description('a')
}
`);

        const result = checkAnnotationsAreValid(blocks);

        expect(result).toHaveLength(1);
        expect(result[0].range).toBeDefined();
    });
});

function getDictionaryBlocks(text: string): DictionaryBlock[] {
    return parseBruFile(
        new TextDocumentHelper(text),
        BrunoFileType.RequestFile,
    ).blocks.filter(isBlockDictionaryBlock);
}
