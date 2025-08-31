export enum NonBlockSpecificDiagnosticCode {
    // meta block
    MissingMetaBlock = "bru1",
    MetaBlockNotInFirstLine = "bru2",

    // method block
    IncorrectNumberofHttpMethodBlocks = "bru3",

    // auth block
    TooManyAuthBlocksDefined = "bru4",

    // body block
    TooManyBodyBlocksDefined = "bru5",

    // other
    MultipleDefinitionsForSameBlocks = "bru6",
    TextOutsideOfBlocks = "bru7",
    AuthBlockNotMatchingTypeFromMethodBlock = "bru8",
    BodyBlockNotMatchingTypeFromMethodBlock = "bru9",
    BlocksWithUnknownNamesDefined = "bru10",
    DictionaryBlocksNotStructuredCorrectly = "bru11",
    NoAssertOrTestsBlockDefined = "bru12",
    BlocksNotAllSeparatedBySingleEmptyLine = "bru13",
    UrlFromMethodBlockNotMatchingQueryParamsBlock = "bru14",
    UrlFromMethodBlockMissingPathParams = "bru15",
    PathParamsBlockMissingValuesFromUrl = "bru16",
    UrlFromMethodBlockNotMatchingPathParamsBlock = "bru17",
    QueryParamsBlockMissing = "bru18",
    PathParamsBlockMissing = "bru19",
    GraphQlBlocksDefinedForNonGraphQlRequestType = "bru20",
    ArrayBlocksNotStructuredCorrectly = "bru21",
    DictionaryBlocksWithoutContent = "bru22",
    AuthBlockNotMatchingAuthModeBlock = "bru23",
    RedundantBlocksDefined = "bru24",
    CodeBlockMissingClosingBracket = "bru25",
    SimpleFieldsInDictionaryBlocksNotStructuredCorrectly = "bru26",
}
