import {MixEmulator, type MixState} from "../mix/mix-emulator.ts";
import React, {useEffect, useState} from "react";
import {Box, Typography} from "@mui/material";
import {MonospacedBox} from "./Common.tsx";
import {formatBoolean, formatNumber} from "../mix/utils.ts";

export function MixStateView({mix}: { mix: MixEmulator }) {
    const [state, setState] = useState<MixState>(mix.state);
    useEffect(() => {
        mix.onStateChange((e) => {
            setState(e.state);
        });
    }, []);
    return <>
        <Box sx={{marginRight: 1}}>
            <Typography variant={"caption"}>Program Counter</Typography>
            <MonospacedBox>
                {formatNumber(state.pc, 4)}
            </MonospacedBox>
        </Box>
        <Box sx={{marginRight: 1}}>
            <Typography variant={"caption"}>Overflow</Typography>
            <MonospacedBox>
                {formatBoolean(state.overflow)}
            </MonospacedBox>
        </Box>
        <Box sx={{marginRight: 1}}>
            <Typography variant={"caption"}>Compare</Typography>
            <MonospacedBox>
                {state.compare === 1 ? ">" : (state.compare === -1 ? '<' : '=')}
            </MonospacedBox>
        </Box>
    </>;
}