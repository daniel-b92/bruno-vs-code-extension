export enum DiagnosticCode {
    // Meta block
    MissingMetaBlock = "bruLang_MissingMetaBlock",
    MetaBlockNotInFirstLine = "bruLang_MetaBlockNotInFirstLine",
    SequenceNotUniqueWithinFolder = "bruLang_SequenceNotUniqueWithinFolder",

    // Method block
    IncorrectNumberofHttpMethodBlocks = "bruLang_IncorrectNumberofHttpMethodBlocks",

    // Auth block
    TooManyAuthBlocksDefined = "bruLang_TooManyAuthBlocksDefined",

    // Body block
    TooManyBodyBlocksDefined = "bruLang_TooManyBodyBlocksDefined",

    // Other
    MultipleDefinitionsForSameBlocks = "bruLang_MultipleDefinitionsForSameBlocks",
    TextOutsideOfBlocks = "bruLang_TextOutsideOfBlocks",
    BodyBlockNotMatchingTypeFromMethodBlock = "bruLang_BodyBlockNotMatchingTypeFromMethodBlock",
}
