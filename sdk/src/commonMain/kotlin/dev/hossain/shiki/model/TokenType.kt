package dev.hossain.shiki.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Semantic token type returned by the `/highlight/semantic` endpoint. */
@Serializable
enum class TokenType {
    @SerialName("keyword") KEYWORD,
    @SerialName("type") TYPE,
    @SerialName("modifier") MODIFIER,
    @SerialName("function") FUNCTION,
    @SerialName("tag") TAG,
    @SerialName("attribute") ATTRIBUTE,
    @SerialName("parameter") PARAMETER,
    @SerialName("variable") VARIABLE,
    @SerialName("number") NUMBER,
    @SerialName("constant") CONSTANT,
    @SerialName("string") STRING,
    @SerialName("comment") COMMENT,
    @SerialName("punctuation") PUNCTUATION,
    @SerialName("plain") PLAIN,
}
