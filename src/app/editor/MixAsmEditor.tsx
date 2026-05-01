import {EditorView, keymap, lineNumbers} from "@codemirror/view";
import {emacsStyleKeymap} from "@codemirror/commands";
import {compile, type MixProgram} from "../../mixal/mix-asm.ts";
import {Box, Button, Divider, Menu, MenuItem, type SxProps, type Theme, Tooltip, Typography} from "@mui/material";
import React, {type MouseEvent, useCallback, useEffect, useMemo, useState} from "react";
import {EXAMPLE_MIX_PROGRAMS} from "../examples.ts";
import {PanelBox} from "../common/Common.tsx";
import CodeMirror, {basicSetup} from "@uiw/react-codemirror";
import {parser} from "../../mixal/parser/parser";
import {styleTags, tags as t} from "@lezer/highlight"
import {HighlightStyle, LanguageSupport, LRLanguage, syntaxHighlighting} from '@codemirror/language';
import {formatMixal} from "../../mixal/mixal-formatter.ts";

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
            "(": t.paren,
            ")": t.paren,
        }),
    ]
})

const mixalLanguage = LRLanguage.define({
    parser: parserWithMetadata
});

function mixal() {
    return new LanguageSupport(mixalLanguage, []);
}

const myHighlightStyle = HighlightStyle.define([
    {tag: t.string, color: "#ff0000", fontStyle: "bold"},
    {tag: t.keyword, color: "#4903d5", fontStyle: "bold"},
    {tag: t.comment, color: "#04af56", fontStyle: "italic"},
    {tag: t.lineComment, color: "#04af56", fontStyle: "italic"},
    {tag: t.variableName, color: "#d56203"},
    {tag: t.definition(t.variableName), color: "#d56203", fontStyle: "bold"},
    {tag: t.number, color: "#55a1eb"},
])

interface EditorFileMenuProps {
    onOpenFile: (code: string) => void;
}

function EditorFileMenu({onOpenFile}: EditorFileMenuProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);
    const id = open ? 'examples-popover' : undefined;

    const getMixProgram = async (path: string) => {
        const code = await fetch(path).then((r) => r.text());
        onOpenFile(code);
    }

    const examples = useMemo(() => {
        return Object.entries(EXAMPLE_MIX_PROGRAMS).map(([title, {src, desc}], i) => {
            return (
                <MenuItem key={i} onClick={() => {
                    console.log(src, desc);
                    getMixProgram(src);
                    handleClose();
                }
                }>
                    <Tooltip title={<Typography variant={'caption'}>{desc}</Typography>} placement={'right'}>
                        <Typography>{title}</Typography>
                    </Tooltip>
                </MenuItem>
            )
        })
    }, [EXAMPLE_MIX_PROGRAMS]);

    useEffect(() => {
        const saved = localStorage.getItem("mixal-code");
        if (saved !== null) {
            onOpenFile(saved);
        } else {
            getMixProgram('/examples/table-of-primes.ms');
        }
    }, []);

    return (<>
        <Button onClick={handleClick}>Examples</Button>
        <Menu
            id={id}
            open={open}
            anchorEl={anchorEl}
            onClose={handleClose}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
            }}>
            {examples}
        </Menu>
    </>)
}

const extensions = [
    basicSetup({tabSize: 8}),
    keymap.of(emacsStyleKeymap),
    lineNumbers(),
    EditorView.theme({
        "&": {height: "100%", width: '100%', maxWidth: '100%'},
        ".cm-scroller": {overflowY: "auto"}
    }),
    syntaxHighlighting(myHighlightStyle),
    mixal(),
];

interface MixAsmEditorProps {
    onCompile: (_: MixProgram) => void;
    sx?: SxProps<Theme> | undefined;
}

const COMPILE_DELAY_MS = 1000;

export function MixAsmEditor({onCompile, sx}: MixAsmEditorProps) {
    const [code, setCode] = useState('');
    const [compileTimeout, setCompileTimeout] = useState<any>(null);
    const handleCodeChange = useCallback((codeText: string, delayMs: number = COMPILE_DELAY_MS) => {
        setCode(codeText);
        if (compileTimeout !== null) {
            clearTimeout(compileTimeout);
        }
        const t = setTimeout(() => {
            const p = compile(codeText);
            onCompile(p);
            setCompileTimeout(null);
        }, delayMs);
        setCompileTimeout(t);
        return t;
    }, []);
    return (<PanelBox sx={sx}>
        <Box sx={{flexDirection: 'row', display: 'flex', height: '24px'}}>
            <EditorFileMenu onOpenFile={(value) => handleCodeChange(formatMixal(value), 0)}/>
            <Button onClick={() => {
                handleCodeChange(formatMixal(code), 0);
            }}>Format</Button>
            <Button onClick={() => handleCodeChange('', 0)}>New</Button>
        </Box>
        <Divider/>
        <CodeMirror style={{fontSize: '0.8rem', flexGrow: 1, height: 'calc(100% - 30px)'}}
                    value={code}
                    extensions={extensions}
                    onChange={(value) => {
                        localStorage.setItem('mixal-code', value)
                        handleCodeChange(value);
                    }}
        />
    </PanelBox>)
}