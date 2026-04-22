import React, {useCallback, useEffect, useState} from "react";
import {Box, Paper} from "@mui/material";
import type {MixCommonDeviceViewProps} from "./MixDevicesView.tsx";

export type MixCardPuncherProps = {} & MixCommonDeviceViewProps;

function PageView({lines}: { lines: string[] }) {
    const fontFamily = 'LinePrinter';
    return <Paper elevation={3} sx={{
        maxWidth: '60%',
        minWidth: '210mm',
        minHeight: '97mm',
        marginLeft: 'auto',
        marginRight: 'auto',
        marginTop: 4,
        marginBottom: 4,
        display: 'flex',
        justifyItems: 'center',
        flexDirection: 'column',
        padding: '4em 2em'
    }}>
        {lines?.map((line, no) => {
            return <Box key={no} sx={{
                whiteSpace: "pre",
                fontFamily: fontFamily
            }}>{line}</Box>
        })}
    </Paper>
}

export function MixCardPuncher({connection}: MixCardPuncherProps) {
    const [lines, setLines] = useState<string[]>([]);
    const textSink = useCallback(async (text: string): Promise<void> => {
        setLines(prev => [...prev, text]);
    }, []);
    useEffect(() => {
        connection.setTextSink(textSink);
    }, [textSink]);
    return (<Box>
        {<PageView lines={lines}/>}
    </Box>);
}