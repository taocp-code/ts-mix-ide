import React, {useEffect, useState} from "react";
import {MixEmulator} from "../../emulator/mix-emulator.ts";
import {type MixProgram} from "../../emulator/mix-asm.ts";
import {Alert, Box, Chip, Divider, IconButton, Stack, type SxProps, type Theme, Tooltip} from '@mui/material';
import RedoIcon from "@mui/icons-material/Redo";
import FastForwardIcon from "@mui/icons-material/FastForward";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {MixStateView} from "./MixStateView.tsx";
import {PanelBox} from "../common/Common.tsx";
import {MixWordView} from "../common/MixWord.tsx";
import {MixMemoryView} from "./MixMemoryView.tsx";

interface MixMachineControllerProps {
    mix: MixEmulator,
    mixProgram: MixProgram | null;
}

function MixMachineController({mix, mixProgram}: MixMachineControllerProps) {
    const [state, setState] = useState(mix.state);
    const [asyncStepDelayMs] = useState(50);
    useEffect(() => {
        mix.onStateChange((e) => setState(e.state));
    }, []);
    const halted = state.halt;
    const running = state.running;
    const ioBusy = state.ioBusy;
    return <>
        {<><Tooltip title={'Step'}>
            <IconButton sx={{color: 'blue'}} onClick={async () => {
                await mix.step();
            }} disabled={running || halted || ioBusy}><RedoIcon/></IconButton>
        </Tooltip>
            <Tooltip title={running ? 'Stop' : 'Run'}>
                <IconButton disabled={halted || ioBusy} sx={{color: running ? 'red' : 'green'}} onClick={async () => {
                    if (!running) {
                        await mix.runAsync(asyncStepDelayMs);
                    } else {
                        mix.stopAsync();
                    }
                }}>{running ? <PauseIcon/> : <PlayArrowIcon/>}</IconButton>
            </Tooltip>
            <Tooltip title={"Fast Run"}>
                <IconButton disabled={running || halted || ioBusy} onClick={async () => {
                    await mix.runAsync(0);
                }}><FastForwardIcon/></IconButton>
            </Tooltip>
        </>}
        <Tooltip title={"Reset"}>
            <IconButton sx={{color: 'maroon'}} onClick={() => {
                setTimeout(() => {
                    mix.reset();
                    if (mixProgram !== null) {
                        mix.loadProgram(mixProgram);
                    }
                });
            }} disabled={running || ioBusy}><RestartAltIcon/></IconButton>
        </Tooltip>
        <Box>
            <Tooltip title={"Emulator Status"}>
                <>{ioBusy && <Chip size={"small"} color={"warning"} label={"IO busy"} sx={{m: 1}}/>}
                    {halted
                        ? <Chip size={"small"} color={"error"} label={"Halted"} sx={{m: 1}}/>
                        : (
                            state.running
                                ? <Chip size={"small"} color={"success"} label={"Running"} sx={{m: 1}}/>
                                : <Chip size={"small"} color={"default"} label={"Paused"} sx={{m: 1}}/>
                        )
                    }</>
            </Tooltip>
            <Tooltip title={"Total real world time spent in execution."}>
                <Chip size={"small"} color={"info"}
                      label={`RTT: ${state.totalRealTime.toFixed(3)}s`}
                      sx={{m: 1, minWidth: '100px'}}
                      variant={"outlined"}/>
            </Tooltip>
            <Tooltip title={"Total MIX machine time spent in execution."}>
                <Chip size={"small"} color={"info"} label={`MTT: ${state.totalTime}u`} sx={{m: 1, minWidth: '100px'}}
                      variant={"outlined"}/>
            </Tooltip>
            <Tooltip title={"Total instructions executed."}>
                <Chip size={"small"} color={"info"} label={`INS: ${state.instructions}`} sx={{m: 1, minWidth: '100px'}}
                      variant={"outlined"}/>
            </Tooltip>
            <Tooltip title={"Instructions per second."}>
                <Chip size={"small"} color={"info"} label={`IPS: ${state.ips.toFixed(1)}`}
                      sx={{m: 1, minWidth: '100px'}}
                      variant={"outlined"}/>
            </Tooltip>
        </Box>
    </>;
}

interface MixMachineViewProps {
    mix: MixEmulator;
    mixProgram: MixProgram | null;
    sx?: SxProps<Theme> | undefined;
}

export function MixMachineView({mix, mixProgram, sx}: MixMachineViewProps) {
    const [state, setState] = useState(mix.state);
    useEffect(() => {
        mix.onStateChange((e) => {
            setState(e.state);
        });
    }, []);

    return (<PanelBox sx={sx}>
        {state.error && <Alert variant={"filled"} color={"error"} title={state.error}>{state.error}</Alert>}
        <Box sx={{flexDirection: 'row', display: 'flex', p: 1}}>
            {<MixMachineController mix={mix} mixProgram={mixProgram}/>}
        </Box>
        <Divider/>
        <Box sx={{flexDirection: 'row', display: 'flex', p: 1}}>
            <MixStateView mix={mix}/>
        </Box>
        <Divider/>
        <Stack direction={'row'} sx={{p: 1}} divider={<Divider orientation={"vertical"} flexItem={true}/>} spacing={1}>
            <MixWordView word={mix.rA}/>
            <MixWordView word={mix.rX}/>
        </Stack>
        <Stack direction={'row'} sx={{p: 1}} divider={<Divider orientation={"vertical"} flexItem={true}/>} spacing={1}>
            <MixWordView word={mix.rI1}/>
            <MixWordView word={mix.rI2}/>
            <MixWordView word={mix.rI3}/>
            <MixWordView word={mix.rI4}/>
            <MixWordView word={mix.rI5}/>
            <MixWordView word={mix.rI6}/>
            <MixWordView word={mix.rJ}/>
        </Stack>
        <Divider/>
        <Box sx={{flexDirection: 'column', display: 'flex', p: 0.5, overflowY: 'scroll'}}>
            <MixMemoryView mix={mix}/>
        </Box>
    </PanelBox>)
}