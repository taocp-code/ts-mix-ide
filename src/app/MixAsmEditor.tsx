import {EditorView, keymap, lineNumbers} from "@codemirror/view";
import {emacsStyleKeymap} from "@codemirror/commands";
import {compile, type MixProgram} from "../emulator/mix-asm.ts";
import {MixEmulator} from "../emulator/mix-emulator.ts";
import {Box, Button, Divider, Menu, MenuItem, type SxProps, type Theme} from "@mui/material";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import tableOfPrimes from "../example-mix-programs/table-of-primes.mixal?raw";
import {ExampleMixPrograms} from "../example-mix-programs";
import {PanelBox} from "./Common.tsx";
import CodeMirror from "@uiw/react-codemirror";

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

    const examples = useMemo(() => {
        return Object.entries(ExampleMixPrograms).map(([path, {src}], i) => {
            return (
                <MenuItem key={i} onClick={() => {
                    onOpenFile(src);
                    handleClose();
                }
                }>{path.substring(2)}</MenuItem>
            )
        })
    }, [ExampleMixPrograms]);

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
            <EditorFileMenu onOpenFile={(value) => setCode(value)}/>
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