import React, {useEffect, useMemo, useState} from "react";
import {MixEmulator} from "../emulator/mix-emulator.ts";
import {Box, Container, Stack} from "@mui/material";
import {type MixProgram} from "../emulator/mix-asm.ts";
import {MixMachineView} from "./machine/MixMachineView.tsx";
import {MixProgramView} from "./editor/MixProgramView.tsx";
import {MixAsmEditor} from "./editor/MixAsmEditor.tsx";

export function MixEmulatorApp() {
    const mix = useMemo(() => new MixEmulator(), []);
    const [mixProgram, setMixProgram] = useState<MixProgram | null>(null);

    useEffect(() => {
        if (mixProgram !== null) {
            mix.loadProgram(mixProgram);
        }
    }, [mixProgram]);

    const mainUIMaxHeight = useMemo(() => `calc(100% - 40px)`, []);

    return (
        <Container sx={{maxWidth: '100%', height: '100vh'}} maxWidth={false}>
            <Box sx={{
                flexDirection: 'row', display: 'flex', p: '4px', height: '32px', '& img': {
                    height: '100%',
                },
                justifyContent: 'space-between',
                width: '100%',
            }}>
                <img src={'/mix.png'} alt={"MIX"}/>
                <a target={"_blank"}
                   style={{display: "inline-block", width: "24px"}}
                   href={"https://github.com/taocp-code/ts-mix-ide#"}>
                    <img src={'/GitHub_Invertocat_Black_Clearspace.png'}/>
                </a>
            </Box>

            <Stack direction={"row"} sx={{
                alignItems: 'stretch', maxHeight: mainUIMaxHeight,
                width: '100%'
            }}>
                <MixAsmEditor
                    sx={{flexGrow: 1, minWidth: '20%'}}
                    onCompile={(p) => setMixProgram(p)}/>
                <MixProgramView
                    sx={{flexGrow: 2, minWidth: 'max(25%, 490px)'}}
                    mix={mix}
                    mixProgram={mixProgram}/>
                <MixMachineView
                    sx={{flexGrow: 2}}
                    mix={mix} mixProgram={mixProgram}/>
            </Stack>
        </Container>
    )
}