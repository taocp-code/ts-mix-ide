import React, {useEffect, useMemo, useState} from "react";
import {MixEmulator} from "../emulator/mix-emulator.ts";
import {Box, Button, Container, Stack, Typography} from "@mui/material";
import {type MixProgram} from "../emulator/mix-asm.ts";
import {MixMachineView} from "./MixMachineView.tsx";
import {MixProgramView} from "./MixProgramView.tsx";
import {MixDevicesView} from "./MixDevicesView.tsx";
import {MixAsmEditor} from "./MixAsmEditor.tsx";
import type {MixDevice} from "../emulator/mix-io.ts";
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {PanelBox} from "./Common.tsx";

const MIX_DEVICES_UI_HEIGHT_OPEN = 340;
const MIX_DEVICES_UI_HEIGHT_CLOSED = 32;

function MixDevicesDrawer({devices, devicesHeight, onStateChange}: {
    devices: MixDevice[],
    devicesHeight: number,
    onStateChange: (height: number) => void
}) {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        onStateChange(open ? MIX_DEVICES_UI_HEIGHT_OPEN : MIX_DEVICES_UI_HEIGHT_CLOSED);
    }, [open]);
    return (
        <PanelBox sx={{
            height: `${devicesHeight}px`,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid silver'
        }}>
            <Box sx={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                borderBottom: 1,
                borderColor: 'divider',
            }}>
                <Button onClick={() => {
                    setOpen(!open);
                }} size={"small"}>
                    {open ? <KeyboardArrowDownIcon/> : <KeyboardArrowUpIcon/>}
                    <Typography>I/O</Typography>
                </Button>
            </Box>
            {<MixDevicesView devices={devices} sx={{flexGrow: '1', maxHeight: '100%', display: open ? 'flex' : 'none'}}/>}
        </PanelBox>
    );
}

export function MixEmulatorApp() {
    const mix = useMemo(() => new MixEmulator(), []);
    const [mixProgram, setMixProgram] = useState<MixProgram | null>(null);
    const [devicesHeight, setDevicesHeight] = useState(MIX_DEVICES_UI_HEIGHT_CLOSED); // px

    useEffect(() => {
        if (mixProgram !== null) {
            mix.loadProgram(mixProgram);
        }
    }, [mixProgram]);

    const mainUIMaxHeight = useMemo(() => `calc(100% - ${devicesHeight + 40}px)`, [devicesHeight]);

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
                    sx={{flexGrow: 2, minWidth: 'max(25%, 490px)'}}
                    mix={mix}
                    mixProgram={mixProgram}/>
                <MixMachineView
                    sx={{flexGrow: 2}}
                    mix={mix} mixProgram={mixProgram}/>
            </Stack>
            <MixDevicesDrawer devices={mix.devices} devicesHeight={devicesHeight}
                              onStateChange={(height) => setDevicesHeight(height)}/>
        </Container>
    )
}