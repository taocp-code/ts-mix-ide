import {EditorView, keymap, lineNumbers} from "@codemirror/view";
import {emacsStyleKeymap} from "@codemirror/commands";
import {compile, type MixProgram} from "../../mixal/mix-asm.ts";
import {Box, Button, Divider, Menu, MenuItem, type SxProps, type Theme, Tooltip, Typography} from "@mui/material";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {EXAMPLE_MIX_PROGRAMS} from "../examples.ts";
import {PanelBox} from "../common/Common.tsx";
import CodeMirror from "@uiw/react-codemirror";
import {parser} from "../../mixal/parser/parser";
import {styleTags, tags as t} from "@lezer/highlight"
import {HighlightStyle, syntaxHighlighting, LRLanguage, LanguageSupport} from '@codemirror/language';
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
    const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
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
        getMixProgram('/examples/table-of-primes.ms');
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
    keymap.of(emacsStyleKeymap),
    lineNumbers(),
    EditorView.theme({
        "&": {height: "100%", width: '100%', maxWidth: '100%'},
        ".cm-scroller": {overflow: "auto"}
    }),
    syntaxHighlighting(myHighlightStyle),
    mixal(),
];

interface MixAsmEditorProps {
    onCompile: (_: MixProgram) => void;
    sx?: SxProps<Theme> | undefined;
}

export function MixAsmEditor({onCompile, sx}: MixAsmEditorProps) {
    const [code, setCode] = useState('');
    const [formattedCode, setFormattedCode] = useState('');
    const startCompile = useCallback(() => {
        return setTimeout(() => {
            const p = compile(formattedCode);
            onCompile(p);
        });
    }, [formattedCode]);

    useEffect(() => {
        const t = startCompile();
        return () => clearTimeout(t);
    }, [formattedCode]);
    useEffect(() => {
        setFormattedCode(formatMixal(code));
    }, [code]);

    return (<PanelBox sx={sx}>
        <Box sx={{flexDirection: 'row', display: 'flex', height: '24px'}}>
            <EditorFileMenu onOpenFile={(value) => setCode(value)}/>
        </Box>
        <Divider/>
        <CodeMirror style={{fontSize: '0.8rem', flexGrow: 1, height: 'calc(100% - 30px)'}}
                    value={formattedCode}
                    extensions={extensions}
                    onChange={(value) => {
                        setCode(value);
                    }}
        />
    </PanelBox>)
}