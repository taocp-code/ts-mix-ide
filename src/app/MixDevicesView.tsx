import React, {useEffect, useMemo, useState} from "react";
import {Box, Button, Paper, Tab, Tabs, TextField} from "@mui/material";
import {
    CardPuncher,
    CardReader,
    type MixDevice,
    MixDeviceType,
    MixPrinter,
    TeletypeWriter
} from "../emulator/io/mix-device.ts";
import {PanelBox} from "./Common.tsx";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import {formatNumber} from "../emulator/utils.ts";

export const MIX_DEVICES_UI_HEIGHT_OPEN = 340;
export const MIX_DEVICES_UI_HEIGHT_CLOSED = 32;

interface MixDevicesViewProps {
    devicesRef: Record<number, MixDevice>,
    devicesHeight: number,
    onStateChange: (height: number) => void
}

type Resolve<T> = (v: T | PromiseLike<T>) => void;

export function MixDevicesView({devicesRef, devicesHeight, onStateChange}: MixDevicesViewProps) {
    const [activeDeviceId, setActiveDeviceId] = useState("18");
    const [, setTextInput] = useState<Record<number, Resolve<string>>>({});
    const [textOutput, setTextOutput] = useState<Record<number, string[]>>({});
    const appendText = (i: number, text: string) => {
        setTextOutput(buffers => {
            buffers[i].push(text);
            return {...buffers};
        })
    };
    const clearText = (i: number) => {
        setTextOutput(buffers => {
            buffers[i] = [];
            return {...buffers};
        })
    };
    const startTextInput = async (i: number): Promise<string> => {
        return new Promise(resolve => {
            setTextInput(promises => {
                promises[i] = (t) => resolve(t);
                return {...promises};
            });
        });
    };
    const completeTextInput = (i: number, text: string) => {
        setTextInput(promises => {
            promises[i](text);
            delete promises[i];
            return {...promises};
        });
    }
    const browserPromptTextSource = (i: number) => {
        return async (n: number): Promise<string> => {
            const promise = startTextInput(i);
            setTimeout(() => {
                let text = '';
                while (true) {
                    const line = prompt(`Input at most ${n} characters:`);
                    if (line !== null) {
                        if (line.length === n) {
                            text = line.toUpperCase();
                        } else if (line.length < n) {
                            text = line.padEnd(n, ' ').toUpperCase();
                        } else {
                            text = line.toUpperCase();
                        }
                        break;
                    }
                }
                completeTextInput(i, text);
            });
            return promise;
        }
    }
    const devices = useMemo(() => {
        console.log(`Initializing devices.`, devicesRef);
        const textOutputBuffers: Record<number, string[]> = {};
        for (let i = 0; i <= 20; i++) {
            if (i <= 7) {
                console.log(`No tape device found, ignoring unit number: ${i}.`);
            } else if (i <= 15) {
                console.log(`No disk device found, ignoring unit number: ${i}.`)
            } else {
                textOutputBuffers[i] = [];
                switch (i) {
                    case 16:
                        devicesRef[i] = new CardReader(browserPromptTextSource(i));
                        break;
                    case 17:
                        devicesRef[i] = new CardPuncher((text: string) => new Promise(resolve => {
                            console.log(`Card Puncher| output: "${text}".`);
                            appendText(i, text);
                            resolve();
                        }));
                        break;
                    case 18:
                        devicesRef[i] = new MixPrinter((text: string) => new Promise(resolve => {
                            console.log(`Printer| output: "${text}".`);
                            appendText(i, text);
                            resolve();
                        }), () => new Promise(resolve => {
                            console.log(`Printer| IOC: new page.`);
                            clearText(i);
                            resolve();
                        }));
                        break;
                    case 19:
                        devicesRef[i] = new TeletypeWriter(
                            (text: string) => new Promise(resolve => {
                                console.log(`TeletypeWriter| output: "${text}".`);
                                appendText(i, text);
                                resolve();
                            }),
                            browserPromptTextSource(i),
                        );
                        break;
                }
            }
        }
        setTextOutput(prev => ({
            ...prev,
            ...textOutputBuffers
        }));
        return devicesRef;
    }, []);
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
                    {Object.keys(devices).map(id => {
                        return (<Tab key={id} value={id} onClick={() => setActiveDeviceId(id)}
                                     label={`${id} - ` + devices[parseInt(id)].type.replaceAll('_', ' ')}/>);
                    })}
                </Tabs>
            </Box>
            <Box sx={{flexGrow: 1, overflowY: 'scroll'}}>
                {Object.keys(devices).map(id => {
                    if (activeDeviceId !== id) return <></>;
                    const i = parseInt(id);
                    const dev = devices[i];
                    switch (dev.type) {
                        case MixDeviceType.PRINTER: {
                            const fontFamily = 'LinePrinter';
                            return <Paper key={id} elevation={3} sx={{
                                maxWidth: '60%',
                                minWidth: '210mm',
                                minHeight: '297mm',
                                marginLeft: 'auto',
                                marginRight: 'auto',
                                marginTop: 2,
                                marginBottom: 2,
                                display: 'flex',
                                justifyItems: 'center',
                                flexDirection: 'column',
                                padding: '4em 2em'
                            }}>
                                {textOutput[i]?.map((line) => {
                                    return <Box sx={{whiteSpace: "pre", fontFamily: fontFamily}}>{line}</Box>;
                                })}
                            </Paper>
                        }
                        case MixDeviceType.TYPEWRITER: {
                            const fontFamily = "ElegantTypeWriter";
                            return <Paper key={id} elevation={3} sx={{
                                maxWidth: '60%',
                                minWidth: '210mm',
                                minHeight: '97mm',
                                marginLeft: 'auto',
                                marginRight: 'auto',
                                marginTop: 4,
                                marginBottom: -2,
                                display: 'flex',
                                justifyItems: 'center',
                                flexDirection: 'column',
                                padding: '4em 2em'
                            }}>
                                {textOutput[i]?.map((line, no) => {
                                    return <Box sx={{
                                        whiteSpace: "pre",
                                        fontFamily: fontFamily
                                    }}>{formatNumber(no)}&gt; {line}</Box>
                                })}
                            </Paper>
                        }
                        case MixDeviceType.CARD_PUNCHER: {
                            return <Paper key={id} elevation={3} sx={{}}>
                                {textOutput[i]?.map((line, no) => {
                                    return <Box sx={{
                                        whiteSpace: "pre",
                                        fontFamily: "monospace"
                                    }}>Card #{formatNumber(no)}: {line}</Box>
                                })}
                            </Paper>
                        }
                        case MixDeviceType.CARD_READER: {
                            return <Paper key={id} sx={{width: '100%'}}>
                                <TextField sx={{width: '100%'}} size={"small"} variant={"standard"}/>
                            </Paper>
                        }
                        default:
                            return <>Unkown Device {dev.type}</>
                    }
                })}
            </Box>
        </PanelBox>
    );
}