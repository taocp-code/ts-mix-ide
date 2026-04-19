import {EditorView, keymap, lineNumbers} from "@codemirror/view";
import {emacsStyleKeymap} from "@codemirror/commands";
import {compile, type MixProgram} from "../mix/mix-asm.ts";
import {MixEmulator} from "../mix/mix-emulator.ts";
import {Box, Button, Divider, type SxProps, type Theme} from "@mui/material";
import React, {useCallback, useEffect, useState} from "react";
import tableOfPrimes from "../mix-programs/table-of-primes.mixal?raw";
import {PanelBox} from "./Common.tsx";
import CodeMirror from "@uiw/react-codemirror";

const extensions = [
    keymap.of(emacsStyleKeymap),
    lineNumbers(),
    EditorView.theme({
        "&": {height: "100%", width: '100%', maxWidth: '100%'},
        ".cm-scroller": {overflow: "auto"}
    }),
];

interface MixAsmEditorProps {
    onCompile: (_: MixProgram) => void;
    mix: MixEmulator;
    sx?: SxProps<Theme> | undefined;
}

export function MixAsmEditor({onCompile, mix, sx}: MixAsmEditorProps) {
    const [code, setCode] = useState(tableOfPrimes);
    const [state, setState] = useState(mix.state);
    useEffect(() => {
        mix.onStateChange(e => setState(e.state));
    }, []);

    const startCompile = useCallback(() => {
        return setTimeout(() => {
            const p = compile(code);
            onCompile(p);
        });
    }, [code]);

    useEffect(() => {
        const t = startCompile();
        return () => clearTimeout(t);
    }, [code]);

    return (<PanelBox sx={sx}>
        <Box sx={{flexDirection: 'row', display: 'flex', height: '24px'}}>
            <Button disabled={state.running} onClick={() => {
                startCompile();
            }}>
                Compile
            </Button>
        </Box>
        <Divider/>
        <CodeMirror style={{fontSize: '0.8rem', flexGrow: 1, height: 'calc(100% - 30px)'}}
                    value={code}
                    extensions={extensions}
                    onChange={(value) => {
                        setCode(value);
                    }}
        />
    </PanelBox>)
}