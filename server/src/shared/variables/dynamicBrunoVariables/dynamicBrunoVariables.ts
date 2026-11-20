export interface DynamicBrunoVariable {
    /** The name including the leading `$` (e.g. `$guid`). It is case-sensitive. */
    name: string;
    description: string;
    /** Example values, which the variable can be resolved to. */
    examples: string[];
}

/**
 * Bruno's built-in dynamic variables (generated via faker.js on each request).
 * Source: https://docs.usebruno.com/testing/script/dynamic-variables
 */
export function getDynamicBrunoVariables(): readonly DynamicBrunoVariable[] {
    return DYNAMIC_BRUNO_VARIABLES;
}

export function getDynamicBrunoVariableByName(name: string) {
    return DYNAMIC_BRUNO_VARIABLES_BY_NAME.get(name);
}

const DYNAMIC_BRUNO_VARIABLES = [
    // Basic data types
    {
        name: "$guid",
        description: "A random UUID",
        examples: ["550e8400-e29b-41d4-a716-446655440000"],
    },
    {
        name: "$timestamp",
        description: "Current timestamp in seconds",
        examples: ["1562757107"],
    },
    {
        name: "$isoTimestamp",
        description: "Current timestamp in ISO format",
        examples: ["2024-03-20T12:34:56.789Z"],
    },
    {
        name: "$randomUUID",
        description: "A random UUID",
        examples: ["550e8400-e29b-41d4-a716-446655440000"],
    },
    {
        name: "$randomNanoId",
        description: "A random Nano ID",
        examples: ["V1StGXR8_Z5jdHi6B5cEn4c8b8w"],
    },
    {
        name: "$randomAlphaNumeric",
        description: "A random alpha-numeric character",
        examples: ["6", "y", "z"],
    },
    {
        name: "$randomBoolean",
        description: "A random boolean value",
        examples: ["true", "false"],
    },
    {
        name: "$randomInt",
        description: "A random integer between 0 and 1000",
        examples: ["802", "494", "200"],
    },
    {
        name: "$randomColor",
        description: "A random color",
        examples: ["red", "fuchsia", "grey"],
    },
    {
        name: "$randomHexColor",
        description: "A random hex value",
        examples: ["#47594a", "#431e48", "#106f21"],
    },
    {
        name: "$randomAbbreviation",
        description: "A random abbreviation",
        examples: ["SQL", "PCI", "JSON"],
    },
    {
        name: "$randomWord",
        description: "A random word",
        examples: ["protocol", "interface"],
    },
    {
        name: "$randomWords",
        description: "Multiple random words",
        examples: ["quick brown fox"],
    },

    // Internet and network
    {
        name: "$randomIP",
        description: "A random IPv4 address",
        examples: ["241.102.234.100", "216.7.27.38"],
    },
    {
        name: "$randomIPV4",
        description: "A random IPv4 address",
        examples: ["192.168.1.1"],
    },
    {
        name: "$randomIPV6",
        description: "A random IPv6 address",
        examples: ["dbe2:7ae6:119b:c161:1560:6dda:3a9b:90a9"],
    },
    {
        name: "$randomMACAddress",
        description: "A random MAC address",
        examples: ["33:d4:68:5f:b4:c7", "1f:6e:db:3d:ed:fa"],
    },
    {
        name: "$randomPassword",
        description: "A random 15-character alpha-numeric password",
        examples: ["t9iXe7COoDKv8k3", "QAzNFQtvR9cg2rq"],
    },
    {
        name: "$randomLocale",
        description: "A random two-letter language code (ISO 639-1)",
        examples: ["ny", "sr", "si"],
    },
    {
        name: "$randomUserAgent",
        description: "A random user agent",
        examples: [
            "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10.9.8; rv:15.6) Gecko/20100101 Firefox/15.6.6",
        ],
    },
    {
        name: "$randomProtocol",
        description: "A random internet protocol",
        examples: ["http", "https"],
    },
    {
        name: "$randomSemver",
        description: "A random semantic version number",
        examples: ["7.0.5", "2.5.8", "6.4.9"],
    },
    {
        name: "$randomDomainName",
        description: "A random domain name",
        examples: ["example.com"],
    },
    {
        name: "$randomDomainSuffix",
        description: "A random domain suffix",
        examples: [".com", ".org", ".net"],
    },
    {
        name: "$randomDomainWord",
        description: "A random domain word",
        examples: ["example", "test", "demo"],
    },
    {
        name: "$randomExampleEmail",
        description: "A random example email",
        examples: ["user@example.com"],
    },
    {
        name: "$randomEmail",
        description: "A random email address",
        examples: ["john.doe@example.com"],
    },
    {
        name: "$randomUserName",
        description: "A random username",
        examples: ["johndoe123"],
    },
    {
        name: "$randomUrl",
        description: "A random URL",
        examples: ["https://example.com"],
    },

    // Names and personal information
    {
        name: "$randomFirstName",
        description: "A random first name",
        examples: ["Ethan", "Chandler", "Megane"],
    },
    {
        name: "$randomLastName",
        description: "A random last name",
        examples: ["Schaden", "Schneider", "Willms"],
    },
    {
        name: "$randomFullName",
        description: "A random first and last name",
        examples: ["Connie Runolfsdottir", "Sylvan Fay", "Jonathon Kunze"],
    },
    {
        name: "$randomNamePrefix",
        description: "A random name prefix",
        examples: ["Dr.", "Ms.", "Mr."],
    },
    {
        name: "$randomNameSuffix",
        description: "A random name suffix",
        examples: ["I", "MD", "DD"],
    },
    {
        name: "$randomJobArea",
        description: "A random job area",
        examples: ["Marketing", "Engineering", "Sales"],
    },
    {
        name: "$randomJobDescriptor",
        description: "A random job descriptor",
        examples: ["Senior", "Lead", "Junior"],
    },
    {
        name: "$randomJobTitle",
        description: "A random job title",
        examples: ["Software Engineer", "Product Manager"],
    },
    {
        name: "$randomJobType",
        description: "A random job type",
        examples: ["Full-time", "Contract", "Part-time"],
    },
    {
        name: "$randomPhoneNumber",
        description: "A random phone number",
        examples: ["+1-555-123-4567"],
    },
    {
        name: "$randomPhoneNumberExt",
        description: "A random phone number with extension",
        examples: ["+1-555-123-4567 ext. 123"],
    },

    // Location
    {
        name: "$randomCity",
        description: "A random city name",
        examples: ["New York", "London", "Tokyo"],
    },
    {
        name: "$randomStreetName",
        description: "A random street name",
        examples: ["Main Street", "Park Avenue"],
    },
    {
        name: "$randomStreetAddress",
        description: "A random street address",
        examples: ["123 Main St", "456 Park Ave"],
    },
    {
        name: "$randomCountry",
        description: "A random country name",
        examples: ["United States", "Japan", "Germany"],
    },
    {
        name: "$randomCountryCode",
        description: "A random country code",
        examples: ["US", "JP", "DE"],
    },
    {
        name: "$randomLatitude",
        description: "A random latitude",
        examples: ["40.7128", "35.6762"],
    },
    {
        name: "$randomLongitude",
        description: "A random longitude",
        examples: ["-74.0060", "139.6503"],
    },

    // Images
    {
        name: "$randomAvatarImage",
        description: "A random avatar image URL",
        examples: ["https://i.pravatar.cc/300"],
    },
    {
        name: "$randomImageUrl",
        description: "A random image URL",
        examples: ["https://picsum.photos/200/300"],
    },
    {
        name: "$randomAbstractImage",
        description: "A random abstract image",
        examples: ["https://loremflickr.com/320/240/abstract"],
    },
    {
        name: "$randomAnimalsImage",
        description: "A random animal image",
        examples: ["https://loremflickr.com/320/240/animals"],
    },
    {
        name: "$randomBusinessImage",
        description: "A random business image",
        examples: ["https://loremflickr.com/320/240/business"],
    },
    {
        name: "$randomCatsImage",
        description: "A random cat image",
        examples: ["https://loremflickr.com/320/240/cats"],
    },
    {
        name: "$randomCityImage",
        description: "A random city image",
        examples: ["https://loremflickr.com/320/240/city"],
    },
    {
        name: "$randomFoodImage",
        description: "A random food image",
        examples: ["https://loremflickr.com/320/240/food"],
    },
    {
        name: "$randomNightlifeImage",
        description: "A random nightlife image",
        examples: ["https://loremflickr.com/320/240/nightlife"],
    },
    {
        name: "$randomFashionImage",
        description: "A random fashion image",
        examples: ["https://loremflickr.com/320/240/fashion"],
    },
    {
        name: "$randomPeopleImage",
        description: "A random people image",
        examples: ["https://loremflickr.com/320/240/people"],
    },
    {
        name: "$randomNatureImage",
        description: "A random nature image",
        examples: ["https://loremflickr.com/320/240/nature"],
    },
    {
        name: "$randomSportsImage",
        description: "A random sports image",
        examples: ["https://loremflickr.com/320/240/sports"],
    },
    {
        name: "$randomTransportImage",
        description: "A random transport image",
        examples: ["https://loremflickr.com/320/240/transport"],
    },
    {
        name: "$randomImageDataUri",
        description: "A random image data URI",
        examples: ["data:image/png;base64,..."],
    },

    // Finance
    {
        name: "$randomBankAccount",
        description: "A random bank account number",
        examples: ["1234567890"],
    },
    {
        name: "$randomBankAccountName",
        description: "A random bank account name",
        examples: ["Checking Account"],
    },
    {
        name: "$randomCreditCardMask",
        description: "A masked credit card number",
        examples: ["**** **** **** 1234"],
    },
    {
        name: "$randomBankAccountBic",
        description: "A random BIC code",
        examples: ["DEUTDEFF"],
    },
    {
        name: "$randomBankAccountIban",
        description: "A random IBAN",
        examples: ["DE89370400440532013000"],
    },
    {
        name: "$randomTransactionType",
        description: "A random transaction type",
        examples: ["deposit", "withdrawal"],
    },
    {
        name: "$randomCurrencyCode",
        description: "A random currency code",
        examples: ["USD", "EUR", "JPY"],
    },
    {
        name: "$randomCurrencyName",
        description: "A random currency name",
        examples: ["US Dollar", "Euro", "Yen"],
    },
    {
        name: "$randomCurrencySymbol",
        description: "A random currency symbol",
        examples: ["$", "€", "¥"],
    },
    {
        name: "$randomBitcoin",
        description: "A random Bitcoin address",
        examples: ["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"],
    },

    // Business
    {
        name: "$randomCompanyName",
        description: "A random company name",
        examples: ["TechCorp Inc."],
    },
    {
        name: "$randomCompanySuffix",
        description: "A random company suffix",
        examples: ["LLC", "Inc.", "Ltd."],
    },
    {
        name: "$randomBs",
        description: "A random business buzz phrase",
        examples: ["revolutionize end-to-end systems"],
    },
    {
        name: "$randomBsAdjective",
        description: "A random business adjective",
        examples: ["innovative", "scalable"],
    },
    {
        name: "$randomBsBuzz",
        description: "A random business buzz word",
        examples: ["synergize", "leverage"],
    },
    {
        name: "$randomBsNoun",
        description: "A random business noun",
        examples: ["solutions", "platform"],
    },
    {
        name: "$randomCatchPhrase",
        description: "A random company catch phrase",
        examples: ["Innovate. Create. Transform."],
    },
    {
        name: "$randomCatchPhraseAdjective",
        description: "A random catch phrase adjective",
        examples: ["innovative", "revolutionary"],
    },
    {
        name: "$randomCatchPhraseDescriptor",
        description: "A random catch phrase descriptor",
        examples: ["next-generation", "cutting-edge"],
    },
    {
        name: "$randomCatchPhraseNoun",
        description: "A random catch phrase noun",
        examples: ["solutions", "platform"],
    },

    // Database
    {
        name: "$randomDatabaseColumn",
        description: "A random database column name",
        examples: ["id", "name", "created_at"],
    },
    {
        name: "$randomDatabaseType",
        description: "A random database type",
        examples: ["varchar", "int", "timestamp"],
    },
    {
        name: "$randomDatabaseCollation",
        description: "A random database collation",
        examples: ["utf8_general_ci", "latin1_swedish_ci"],
    },
    {
        name: "$randomDatabaseEngine",
        description: "A random database engine",
        examples: ["InnoDB", "MyISAM"],
    },

    // Dates
    {
        name: "$randomDateFuture",
        description: "A random future date",
        examples: ["2024-12-31T23:59:59.999Z"],
    },
    {
        name: "$randomDatePast",
        description: "A random past date",
        examples: ["2020-01-01T00:00:00.000Z"],
    },
    {
        name: "$randomDateRecent",
        description: "A random recent date",
        examples: ["2024-03-15T12:34:56.789Z"],
    },
    {
        name: "$randomWeekday",
        description: "A random weekday",
        examples: ["Monday", "Tuesday"],
    },
    {
        name: "$randomMonth",
        description: "A random month",
        examples: ["January", "February"],
    },

    // Files and system
    {
        name: "$randomFileName",
        description: "A random file name",
        examples: ["document.pdf"],
    },
    {
        name: "$randomFileType",
        description: "A random file type",
        examples: ["application/pdf"],
    },
    {
        name: "$randomFileExt",
        description: "A random file extension",
        examples: [".pdf", ".jpg"],
    },
    {
        name: "$randomCommonFileName",
        description: "A random common file name",
        examples: ["document.pdf"],
    },
    {
        name: "$randomCommonFileType",
        description: "A random common file type",
        examples: ["application/pdf"],
    },
    {
        name: "$randomCommonFileExt",
        description: "A random common file extension",
        examples: [".pdf", ".jpg"],
    },
    {
        name: "$randomFilePath",
        description: "A random file path",
        examples: ["/path/to/file.txt"],
    },
    {
        name: "$randomDirectoryPath",
        description: "A random directory path",
        examples: ["/usr/local/bin"],
    },
    {
        name: "$randomMimeType",
        description: "A random MIME type",
        examples: ["application/json"],
    },

    // Commerce
    {
        name: "$randomPrice",
        description: "A random price",
        examples: ["99.99", "149.95"],
    },
    {
        name: "$randomProduct",
        description: "A random product",
        examples: ["Chair", "Table"],
    },
    {
        name: "$randomProductAdjective",
        description: "A random product adjective",
        examples: ["Ergonomic", "Modern"],
    },
    {
        name: "$randomProductMaterial",
        description: "A random product material",
        examples: ["Wood", "Metal"],
    },
    {
        name: "$randomProductName",
        description: "A random product name",
        examples: ["Ergonomic Wooden Chair"],
    },
    {
        name: "$randomDepartment",
        description: "A random department name",
        examples: ["Electronics", "Clothing"],
    },

    // Hacker and Lorem
    {
        name: "$randomNoun",
        description: "A random noun",
        examples: ["protocol", "interface"],
    },
    {
        name: "$randomVerb",
        description: "A random verb",
        examples: ["hack", "override"],
    },
    {
        name: "$randomIngverb",
        description: "A random -ing verb",
        examples: ["hacking", "overriding"],
    },
    {
        name: "$randomAdjective",
        description: "A random adjective",
        examples: ["digital", "virtual"],
    },
    {
        name: "$randomPhrase",
        description: "A random phrase",
        examples: ["Try to reboot the SQL bus"],
    },
    {
        name: "$randomLoremWord",
        description: "A random Lorem Ipsum word",
        examples: ["lorem", "ipsum"],
    },
    {
        name: "$randomLoremWords",
        description: "Multiple Lorem Ipsum words",
        examples: ["lorem ipsum dolor"],
    },
    {
        name: "$randomLoremSentence",
        description: "A random Lorem Ipsum sentence",
        examples: ["Lorem ipsum dolor sit amet."],
    },
    {
        name: "$randomLoremSentences",
        description: "Multiple Lorem Ipsum sentences",
        examples: ["Lorem ipsum dolor sit amet. Consectetur adipiscing elit."],
    },
    {
        name: "$randomLoremParagraph",
        description: "A random Lorem Ipsum paragraph",
        examples: ["Lorem ipsum dolor sit amet..."],
    },
    {
        name: "$randomLoremParagraphs",
        description: "Multiple Lorem Ipsum paragraphs",
        examples: [
            "Lorem ipsum dolor sit amet...\\n\\nConsectetur adipiscing elit...",
        ],
    },
    {
        name: "$randomLoremText",
        description: "A random Lorem Ipsum text",
        examples: ["Lorem ipsum dolor sit amet..."],
    },
    {
        name: "$randomLoremSlug",
        description: "A random Lorem Ipsum slug",
        examples: ["lorem-ipsum-dolor"],
    },
    {
        name: "$randomLoremLines",
        description: "Multiple Lorem Ipsum lines",
        examples: ["Lorem ipsum dolor\\nConsectetur adipiscing elit"],
    },
] satisfies DynamicBrunoVariable[];

const DYNAMIC_BRUNO_VARIABLES_BY_NAME = new Map<string, DynamicBrunoVariable>(
    DYNAMIC_BRUNO_VARIABLES.map((variable) => [variable.name, variable]),
);
