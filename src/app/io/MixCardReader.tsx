import React, {useEffect, useMemo, useState} from "react";
import {Box, RadioGroup, TextField, Typography} from "@mui/material";
import type {MixCommonDeviceViewProps} from "./MixDevicesView.tsx";
import {clean} from "../../emulator/mix-chars.ts";

export type MixCardReaderProps = {} & MixCommonDeviceViewProps;

export type ResolvePromise = (text: string | PromiseLike<string>) => void;
export type RejectPromise = (err: any) => void;

export interface PendingRead {
    n: number;
    resolve: ResolvePromise;
    reject: RejectPromise;
}

export function MixCardReader({connection}: MixCardReaderProps) {
    const [buffer, setBuffer] = useState<string>("");
    const [pendingReads, setPendingReads] = useState<PendingRead[]>([]);
    const [text, setText] = useState('');
    const [mode, setMode] = useState<"byte" | "word">("word");

    const maxTextLength = mode === 'word' ? 16 : 80;

    useEffect(() => {
        while (true) {
            const read = pendingReads.shift();
            if (read && read.n <= buffer.length) {
                read.resolve(buffer.slice(0, read.n));
                setBuffer(buffer.slice(read.n));
                setPendingReads([...pendingReads]);
            } else {
                if (read) pendingReads.unshift(read);
                break;
            }
        }
    }, [buffer, pendingReads]);

    const textSource = useMemo(() => async (n: number): Promise<string> => {
        return new Promise((resolve, reject) => {
            const read: PendingRead = {n, resolve, reject};
            setPendingReads(reads => [...reads, read]);
        });
    }, []);

    connection.setTextSource(textSource);
    const onUserInput = (text: string) => {
        setBuffer(prev => {
            if (text.length % maxTextLength !== 0) text = text.padEnd(maxTextLength * Math.ceil(text.length / maxTextLength), ' ');
            if (mode === 'word') {
                const expanded: string[] = [];
                for (let i = 0; i < text.length; i++) {
                    expanded.push(text[i].padStart(5, ' '));
                }
                return prev + expanded.join('');
            } else {
                return prev + text;
            }
        });
    }

    const pendingReadBytes = pendingReads.map(r => r.n).reduce((a, b) => a + b, 0);
    return (<Box>
        <RadioGroup value={mode}>
        </RadioGroup>
        <Typography sx={{fontFamily: 'monospace'}}>Buffered: ({buffer.length})</Typography>
        <Box sx={{whiteSpace: 'pre'}}>{buffer}</Box>
        <Typography>Pending Read Bytes: {pendingReadBytes}</Typography>
        <Typography>Remain: {pendingReadBytes - buffer.length}</Typography>
        <TextField label={"Type Here"} fullWidth={true} value={text} variant={"standard"} size={"small"}
                   sx={{fontFamily: 'monospace'}}
                   onChange={(e) => {
                       setText(clean(e.target.value));
                   }} onKeyDown={e => {
            if (e.key === 'Enter') {
                onUserInput(text);
                setText('');
            }
        }}/>
    </Box>)
}