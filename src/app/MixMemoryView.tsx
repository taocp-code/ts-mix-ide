import {MixEmulator} from "../mix/mix-emulator.ts";
import React, {useMemo} from "react";
import {MixWordView} from "./MixWord.tsx";
import {Box} from "@mui/material";

export function MixMemoryView({mix}: { mix: MixEmulator }) {
    const children = useMemo(() => {
        const wordViews = [];
        for (const w of mix.memory) {
            wordViews.push(<MixWordView key={w.label} word={w}/>);
        }
        return wordViews;
    }, [mix]);
    return <Box sx={{display: 'flex', flexDirection: 'row', flexWrap: 'wrap', width: 'fit-content'}}>
        {children}
    </Box>
}