import {Box} from "@mui/material";
import type {MixCommonDeviceViewProps} from "./MixDevicesView.tsx";
import React, {useCallback, useEffect, useState} from "react";

export type MixTypewriterProps = {} & MixCommonDeviceViewProps;

export function MixTypewriter({connection}: MixTypewriterProps) {
    const [lines, setLines] = useState<string[]>([]);

    const textSink = useCallback(async (text: string): Promise<void> => {
        setLines(prev => {
            return [...prev, text];
        });
    }, []);

    const textSource = useCallback(async (_n: number): Promise<string> => {
        return '';
    }, []);

    useEffect(() => {
        connection.setTextSink(textSink);
        connection.setTextSource(textSource);
    }, [textSink]);

    return (<Box>
        {lines.map((line, i) => <Box key={i}>{line}</Box>)}
    </Box>);
}