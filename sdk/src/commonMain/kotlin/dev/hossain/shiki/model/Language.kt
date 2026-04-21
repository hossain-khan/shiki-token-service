package dev.hossain.shiki.model

/** Known language identifiers accepted by the API. Use as the `language` field in requests. */
object Language {
    const val TEXT = "text"
    const val KOTLIN = "kotlin"
    const val JAVA = "java"
    const val PYTHON = "python"
    const val JAVASCRIPT = "javascript"
    const val TYPESCRIPT = "typescript"
    const val SWIFT = "swift"
    const val GO = "go"
    const val RUST = "rust"
    const val JSON = "json"
    const val YAML = "yaml"
    const val BASH = "bash"
    const val SQL = "sql"
    const val HTML = "html"
    const val CSS = "css"
    const val C = "c"
    const val CPP = "cpp"
    const val RUBY = "ruby"
    const val PHP = "php"
    const val MARKDOWN = "markdown"
    const val XML = "xml"
    const val TOML = "toml"
    const val DOCKERFILE = "dockerfile"
    const val GRAPHQL = "graphql"
    const val CSHARP = "csharp"
    const val SCALA = "scala"
    const val R = "r"
    const val DART = "dart"
    const val POWERSHELL = "powershell"
    const val LUA = "lua"
    const val PERL = "perl"
    const val SHELLSCRIPT = "shellscript"

    val ALL = listOf(
        TEXT, KOTLIN, JAVA, PYTHON, JAVASCRIPT, TYPESCRIPT, SWIFT, GO, RUST,
        JSON, YAML, BASH, SQL, HTML, CSS, C, CPP, RUBY, PHP, MARKDOWN,
        XML, TOML, DOCKERFILE, GRAPHQL,
        CSHARP, SCALA, R, DART, POWERSHELL, LUA, PERL, SHELLSCRIPT,
    )
}
