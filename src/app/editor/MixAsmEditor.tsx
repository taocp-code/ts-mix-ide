import {EditorView, keymap, lineNumbers} from "@codemirror/view";
import {emacsStyleKeymap} from "@codemirror/commands";
import {compile, type MixProgram} from "../../emulator/mix-asm.ts";
import {Box, Button, Divider, Menu, MenuItem, type SxProps, type Theme, Tooltip, Typography} from "@mui/material";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {EXAMPLE_MIX_PROGRAMS} from "../../examples.ts";
import {PanelBox} from "../common/Common.tsx";
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
    sx?: SxProps<Theme> | undefined;
}

export function MixAsmEditor({onCompile, sx}: MixAsmEditorProps) {
    const [code, setCode] = useState('');
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