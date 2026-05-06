import {HighlightStyle, LanguageSupport, LRLanguage} from "@codemirror/language";
import {parser} from "../../mixal/parser/parser";
import {styleTags, tags as t} from "@lezer/highlight";

const parserWithMetadata = parser.configure({
    props: [
        styleTags({
            Symbol: t.definition(t.variableName),
            SymbolRef: t.variableName,
            LocalSymbol: t.definition(t.variableName),
            LocalRef: t.variableName,
            MixOpName: t.keyword,
            MixPseudoOpName: t.keyword,
            MixOpNameCHN: t.keyword,
            MixAlf: t.keyword,
            Asterisk: t.keyword,
            ALF_Text: t.string,
            LineComment: t.lineComment,
            Comment: t.comment,
            CommentText: t.comment,
            Number: t.number,
        }),
    ]
})
const mixalLanguage = LRLanguage.define({
    parser: parserWithMetadata
});

export function mixal() {
    return new LanguageSupport(mixalLanguage, []);
}

export const myHighlightStyle = HighlightStyle.define([
    {tag: t.string, color: "#ff0000", fontStyle: "bold"},
    {tag: t.keyword, color: "#4903d5", fontStyle: "bold"},
    {tag: t.comment, color: "#04af56", fontStyle: "italic"},
    {tag: t.lineComment, color: "#04af56", fontStyle: "italic"},
    {tag: t.variableName, color: "#d56203"},
    {tag: t.definition(t.variableName), color: "#d56203", fontStyle: "bold"},
    {tag: t.number, color: "#55a1eb"},
])