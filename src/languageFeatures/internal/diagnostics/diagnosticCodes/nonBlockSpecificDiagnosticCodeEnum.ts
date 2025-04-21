export enum NonBlockSpecificDiagnosticCode {
    // meta block
    MissingMetaBlock = "bruLang_MissingMetaBlock",
    MetaBlockNotInFirstLine = "bruLang_MetaBlockNotInFirstLine",

    // method block
    IncorrectNumberofHttpMethodBlocks = "bruLang_IncorrectNumberofHttpMethodBlocks",

    // auth block
    TooManyAuthBlocksDefined = "bruLang_TooManyAuthBlocksDefined",

    // body block
    TooManyBodyBlocksDefined = "bruLang_TooManyBodyBlocksDefined",

    // other
    MultipleDefinitionsForSameBlocks = "bruLang_MultipleDefinitionsForSameBlocks",
    TextOutsideOfBlocks = "bruLang_TextOutsideOfBlocks",
    AuthBlockNotMatchingTypeFromMethodBlock = "bruLang_AuthBlockNotMatchingTypeFromMethodBlock",
    BodyBlockNotMatchingTypeFromMethodBlock = "bruLang_BodyBlockNotMatchingTypeFromMethodBlock",
    BlocksWithUnknownNamesDefined = "bruLang_BlocksWithUnknownNamesDefined",
    DictionaryBlocksNotStructuredCorrectly = "bruLang_DictionaryBlocksNotStructuredCorrectly",
    NoAssertOrTestsBlockDefined = "bruLang_NoAssertOrTestsBlockDefined",
}
