export enum DiagnosticCode {
    // Meta block
    MissingMetaBlock = "bruLang_MissingMetaBlock",
    MetaBlockNotInFirstLine = "bruLang_MetaBlockNotInFirstLine",
    SequenceNotUniqueWithinFolder = "bruLang_SequenceNotUniqueWithinFolder",
    SequenceNotNumeric = "bruLang_SequenceNotNumeric",
    KeysMissingInMetaBlock = "bruLang_KeysMissingInMetaBlock",
    UnknownKeysDefinedInMetaBlock = "bruLang_UnknownKeysDefinedInMetaBlock",

    // Method block
    IncorrectNumberofHttpMethodBlocks = "bruLang_IncorrectNumberofHttpMethodBlocks",

    // Auth block
    TooManyAuthBlocksDefined = "bruLang_TooManyAuthBlocksDefined",

    // Body block
    TooManyBodyBlocksDefined = "bruLang_TooManyBodyBlocksDefined",

    // Other
    MultipleDefinitionsForSameBlocks = "bruLang_MultipleDefinitionsForSameBlocks",
    TextOutsideOfBlocks = "bruLang_TextOutsideOfBlocks",
    AuthBlockNotMatchingTypeFromMethodBlock = "bruLang_AuthBlockNotMatchingTypeFromMethodBlock",
    BodyBlockNotMatchingTypeFromMethodBlock = "bruLang_BodyBlockNotMatchingTypeFromMethodBlock",
    BlocksWithUnknownNamesDefined = "bruLang_BlocksWithUnknownNamesDefined",
    DictionaryBlocksNotStructuredCorrectly = "bruLang_DictionaryBlocksNotStructuredCorrectly",
}
