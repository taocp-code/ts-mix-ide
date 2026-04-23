import React, {useEffect, useMemo, useState} from "react";
import {Box, TextField, Typography} from "@mui/material";
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
            const s = prev + text;
            if (s.length < 80) return s.padEnd(80, '.');
            return s.slice(0, 80);
        });
    }

    const pendingReadBytes = pendingReads.map(r => r.n).reduce((a, b) => a + b, 0);
    return (<Box>
        <Typography>Buffered: ({buffer.length}) "{buffer}" </Typography>
        <Typography>Pending Read Bytes: {pendingReadBytes}</Typography>
        <Typography>Remain: {pendingReadBytes - buffer.length}</Typography>
        <TextField label={"Type Here"} fullWidth={true} value={text} variant={"standard"} size={"small"}
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