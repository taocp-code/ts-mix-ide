import React, {useEffect, useMemo, useState} from "react";
import {Box, Button, Paper, Tab, Tabs} from "@mui/material";
import {
    CARD_PUNCHER,
    CARD_READER,
    CardPuncher,
    CardReader,
    DISK,
    type IocHandler,
    LinePrinter,
    MIX_DEVICE_TYPES,
    MixDeviceConfigs,
    MixDeviceRegistry,
    type MixDeviceType,
    type MixTextSink,
    type MixTextSource,
    type MixWordSink,
    type MixWordSource,
    PAPER_TAPE,
    PRINTER,
    TAPE,
    TeletypeWriter,
    TYPE_WRITER
} from "../../emulator/io/mix-device.ts";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import type {MixWord} from "../../emulator/mix-word.ts";
import {MixLinePrinter} from "./MixLinePrinter.tsx";
import {MixCardReader} from "./MixCardReader.tsx";
import {MixCardPuncher} from "./MixCardPuncher.tsx";

export const MIX_DEVICES_UI_HEIGHT_OPEN = 600;
export const MIX_DEVICES_UI_HEIGHT_CLOSED = 32;

interface MixDevicesViewProps {
    mixDeviceRegistry: MixDeviceRegistry,
    onStateChange: (height: number) => void
}

export interface MixCommonDeviceViewProps {
    connection: MixDeviceConnection;
}

export interface MixDeviceActivityEvent {
    deviceId: number;
    userInput: boolean;
}

export type MixDeviceActivityHandler = (e: MixDeviceActivityEvent) => void;

export class MixDeviceConnection {
    deviceId: number = -1;
    type: MixDeviceType;

    private _textSink?: MixTextSink;
    private _textSource?: MixTextSource;
    private _wordSource?: MixWordSource;
    private _wordSink?: MixWordSink;
    private _iocHandler?: IocHandler;

    private _onActivity?: MixDeviceActivityHandler;

    private fireActivity(userInput: boolean) {
        if (this._onActivity) this._onActivity({deviceId: this.deviceId, userInput});
    }

    constructor(type: MixDeviceType) {
        this.type = type;
    }

    async textSource(n: number): Promise<string> {
        this.fireActivity(true);
        if (this._textSource) return this._textSource(n);
        return " ".repeat(n);
    }

    async textSink(text: string): Promise<void> {
        this.fireActivity(false);
        if (this._textSink) this._textSink(text);
    }

    async wordSource(n: number): Promise<MixWord[]> {
        this.fireActivity(true);
        if (this._wordSource) return this._wordSource(n);
        return [];
    }

    async wordSink(words: MixWord[]): Promise<void> {
        this.fireActivity(false);
        if (this._wordSink) return this._wordSink(words);
    }

    async iocHandler(m: number, rX: number): Promise<void> {
        this.fireActivity(false);
        if (this._iocHandler) this._iocHandler(m, rX);
    }

    setTextSource(textSource: MixTextSource) {
        this._textSource = textSource;
    }

    setTextSink(textSink: MixTextSink) {
        this._textSink = textSink;
    }

    setIocHandler(iocHandler: IocHandler) {
        this._iocHandler = iocHandler;
    }

    setOnActivity(onActivity: MixDeviceActivityHandler) {
        this._onActivity = onActivity;
    }
}

export function MixDevicesView({mixDeviceRegistry, onStateChange}: MixDevicesViewProps) {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        onStateChange(open ? MIX_DEVICES_UI_HEIGHT_OPEN : MIX_DEVICES_UI_HEIGHT_CLOSED);
    }, [open]);
    const [activeDeviceId, setActiveDeviceId] = useState("18");
    const onDeviceViewActivity = (e: MixDeviceActivityEvent) => {
        if (!open) setOpen(true);
        setActiveDeviceId(e.deviceId.toString());
    };

    const devices = useMemo<MixDeviceConnection[]>(() => {
        const conns: MixDeviceConnection[] = [];
        for (const type of MIX_DEVICE_TYPES) {
            const {idStart, idEnd} = MixDeviceConfigs[type];
            const count = idEnd - idStart + 1;

            for (let i = 0; i < count; i++) {
                const conn = new MixDeviceConnection(type);
                switch (type) {
                    case DISK:
                        break;
                    case TAPE:
                        break;
                    case CARD_PUNCHER:
                        conn.deviceId = mixDeviceRegistry.register(new CardPuncher(conn.textSink.bind(conn)));
                        break;
                    case CARD_READER:
                        conn.deviceId = mixDeviceRegistry.register(new CardReader(conn.textSource.bind(conn)));
                        break;
                    case PRINTER:
                        conn.deviceId = mixDeviceRegistry.register(new LinePrinter(conn.textSink.bind(conn), conn.iocHandler.bind(conn)));
                        break;
                    case PAPER_TAPE:
                        break;
                    case TYPE_WRITER:
                        conn.deviceId = mixDeviceRegistry.register(new TeletypeWriter(conn.textSink.bind(conn), conn.textSource.bind(conn)));
                        break;
                }
                if (conn.deviceId !== -1) {
                    conn.setOnActivity(onDeviceViewActivity);
                    conns.push(conn);
                }
            }
        }
        return conns;
    }, []);


    const deviceViews: Map<string, React.JSX.Element> = useMemo(() => {
        const views = new Map<string, React.JSX.Element>();
        devices.forEach((conn) => {
            switch (conn.type) {
                case PRINTER:
                    views.set(conn.deviceId.toString(), <MixLinePrinter connection={conn}/>);
                    break;
                case CARD_READER:
                    views.set(conn.deviceId.toString(), <MixCardReader connection={conn}/>);
                    break;
                case CARD_PUNCHER:
                    views.set(conn.deviceId.toString(), <MixCardPuncher connection={conn}/>);
                    break;
            }
        })
        return views;
    }, [devices]);

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: open ? '450px' : '30px',
            maxHeight: open ? '450px' : '30px',
        }}>
            <Paper elevation={2} sx={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                borderBottom: 1,
                borderColor: 'divider',
                paddingTop: '2px',
            }}>
                <Button size={"small"} onClick={() => {
                    setOpen(!open);
                }}>
                    {open ? <KeyboardArrowDownIcon/> : <KeyboardArrowUpIcon/>}
                </Button>
                <Tabs value={activeDeviceId} sx={{
                    minHeight: '30px',
                    '& .MuiTab-root': {
                        minHeight: '24px',
                        padding: '0px 8px',
                    }
                }}>
                    {devices.map(({deviceId, type}) => {
                        return (<Tab key={deviceId} value={deviceId.toString()} onClick={() => {
                            setActiveDeviceId(deviceId.toString());
                            if (!open) setOpen(true);
                        }} label={`${deviceId} - ` + type.replaceAll('_', ' ')}/>);
                    })}
                </Tabs>
            </Paper>
            {devices.map(({deviceId}) => {
                const view = deviceViews.get(deviceId.toString());
                return view && <Box key={deviceId} sx={{flexGrow: 1, overflowY: 'scroll', display: deviceId.toString() === activeDeviceId ? 'block' : 'none'}}>
                    {view}
                </Box>;
            })}

        </Box>
    );
}