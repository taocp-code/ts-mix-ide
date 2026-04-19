import React, {useEffect, useMemo, useState} from "react";
import {MixEmulator} from "../mix/mix-emulator.ts";
import {Box, Container, Stack} from "@mui/material";
import {type MixProgram} from "../mix/mix-asm.ts";
import {MixMachineView} from "./MixMachineView.tsx";
import {MixProgramView} from "./MixProgramView.tsx";
import {MixDevicesView} from "./MixDevicesView.tsx";
import {MixAsmEditor} from "./MixAsmEditor.tsx";

export function MixEmulatorApp() {
    const mix = useMemo(() => new MixEmulator(), []);
    const [mixProgram, setMixProgram] = useState<MixProgram | null>(null);
    const [devicesHeight] = useState(340); // px

    useEffect(() => {
        if (mixProgram !== null) {
            mix.loadProgram(mixProgram);
        }
    }, [mixProgram]);

    const mainUIMaxHeight = `calc(100% - ${devicesHeight + 40}px)`;

    return (
        <Container sx={{maxWidth: '100%', height: '100vh'}} maxWidth={false}>
            <Box sx={{
                flexDirection: 'row', display: 'flex', p: '4px', height: '32px', '& img': {
                    height: '100%',
                },
                width: '100%',
            }}>
                <img src={'/mix.png'} alt={"MIX"}/>
            </Box>

            <Stack direction={"row"} sx={{
                alignItems: 'stretch', maxHeight: mainUIMaxHeight,
                width: '100%'
            }}>
                <MixAsmEditor
                    sx={{flexGrow: 1, minWidth: '20%'}}
                    onCompile={(p) => setMixProgram(p)} mix={mix}/>
                <MixProgramView
                    sx={{flexGrow: 2, minWidth: '25%'}}
                    mix={mix}
                    mixProgram={mixProgram}/>
                <MixMachineView
                    sx={{flexGrow: 2}}
                    mix={mix} mixProgram={mixProgram}/>
            </Stack>

            <Box sx={{
                height: `${devicesHeight}px`,
                display: 'flex',
                flexDirection: 'column',
            }}>
                <MixDevicesView devices={mix.devices} sx={{flexGrow: '1', maxHeight: '100%'}}/>
            </Box>
        </Container>
    )
}