import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {MixEmulator, type MixState} from "../mix/mix-emulator.ts";
import {
    Alert,
    Box,
    type BoxProps,
    Button,
    Chip,
    Container,
    Divider,
    IconButton,
    Paper,
    Stack,
    type SxProps,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    type Theme,
    Tooltip,
    Typography
} from "@mui/material";
import CodeMirror from '@uiw/react-codemirror';
import {EditorView, keymap, lineNumbers} from "@codemirror/view";
import {emacsStyleKeymap} from "@codemirror/commands";
import {compile, type MixProgram, type MixSection} from "../mix/mix-asm.ts";
import {MixWord} from "../mix/mix-word.ts";
import tableOfPrimes from "../mix-programs/table-of-primes.mixal?raw";
import {formatBoolean, formatNumber, formatSign} from "../mix/utils.ts";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FastForwardIcon from '@mui/icons-material/FastForward';
import PauseIcon from '@mui/icons-material/Pause';
import RedoIcon from '@mui/icons-material/Redo';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PrintIcon from '@mui/icons-material/Print';
import {styled} from "@mui/material/styles";
import {lightBlue, purple, red, yellow} from "@mui/material/colors";
import {type MixDevice, MixDeviceType} from "../mix/mix-io.ts";
import {TtyIcon} from "./icons.tsx";

const BoxViewSection = styled(Box)<BoxProps>(() => ({
    borderRadius: 1,
    border: 'silver solid 1px',
    padding: 1,
    margin: 1,
    display: 'flex',
    flexDirection: 'column',
}));

const MonospacedBox = styled(Box)<BoxProps>(() => ({
    padding: '2px',
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    transition: 'color 1000ms'
}));

function MixByte({v}: { v: number }) {
    return <MonospacedBox className={"byte"}>{formatNumber(v, 2)}</MonospacedBox>
}

function MixWordValue({word, showLabel}: { word: MixWord, showLabel?: boolean }) {
    const [w, setW] = useState(new MixWord(word.value, word.label, word.left));
    const [focus, setFocus] = useState(false);
    const [changed, setChanged] = useState(false);
    useEffect(() => {
        word.onChange((e) => {
            setW((prev) => {
                if (prev.value === e.word.value) return prev;
                setChanged(true);
                setTimeout(() => {
                    setChanged(false);
                }, 500);
                return new MixWord(e.word.value, e.word.label, e.word.left)
            });
            setFocus((prev) => {
                if (prev === e.word.attrs['focus']) {
                    return;
                }
                return e.word.attrs['focus'];
            });
        })
    }, []);
    const left = word.left;
    return <Box sx={{
        flexDirection: 'row',
        display: 'flex',
        fontWeight: focus ? 'bold' : 'auto',
        '.byte': {color: changed ? yellow[800] : (focus ? purple[800] : 'auto')},
        '.label': {color: changed ? yellow[800] : red[300]},
    }}>
        {word.label.length > 0 && showLabel && <MonospacedBox className={"label"}>{word.label}</MonospacedBox>}
        <MonospacedBox className={"byte"}>{formatSign(w.sign)}</MonospacedBox>
        {left <= 1 && <MixByte v={w.getByte(1)}/>}
        {left <= 2 && <MixByte v={w.getByte(2)}/>}
        {left <= 3 && <MixByte v={w.getByte(3)}/>}
        {left <= 4 && <MixByte v={w.getByte(4)}/>}
        {left <= 5 && <MixByte v={w.getByte(5)}/>}
    </Box>
}

function MixWordView({word}: { word: MixWord }) {
    const [focus, setFocus] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        word.onChange(e => {
            setFocus((prev) => {
                if (prev === e.word.attrs['focus']) return;
                return e.word.attrs['focus'];
            });
        })
    }, []);
    return <Paper component={'div'} ref={ref}
                  sx={{
                      p: '1px', m: '2px 4px',
                      '&:hover': {
                          backgroundColor: yellow[100]
                      },
                      '&:hover .label': {
                          fontWeight: 'bold',
                      },
                      cursor: 'pointer',
                      backgroundColor: focus ? yellow[100] : 'auto',
                      fontWeight: focus ? 'bold' : 'auto',
                      transition: 'background-color 500ms',
                  }}
                  onMouseOver={() => word.setAttr('focus', true)}
                  onMouseOut={() => word.setAttr('focus', false)}>
        <MixWordValue word={word} showLabel={true}/>
    </Paper>
}

function MixStateView({mix}: { mix: MixEmulator }) {
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

function MixMemoryView({mix}: { mix: MixEmulator }) {
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
    return <>
        {<><Tooltip title={'Step'}>
            <IconButton sx={{color: 'blue'}} onClick={() => {
                mix.step();
            }} disabled={running || halted}><RedoIcon/></IconButton>
        </Tooltip>
            <Tooltip title={running ? 'Stop' : 'Run'}>
                <IconButton disabled={halted} sx={{color: running ? 'red' : 'green'}} onClick={() => {
                    if (!running) {
                        mix.runAsync(asyncStepDelayMs);
                    } else {
                        mix.stopAsync();
                    }
                }}>{running ? <PauseIcon/> : <PlayArrowIcon/>}</IconButton>
            </Tooltip>
            <Tooltip title={"Fast Run"}>
                <IconButton disabled={running || halted} onClick={() => {
                    mix.runAsync(0);
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
            }} disabled={running}><RestartAltIcon/></IconButton>
        </Tooltip>
        <Box>
            <Tooltip title={"Emulator Status"}>
                {halted
                    ? <Chip size={"small"} color={"error"} label={"Halted"} sx={{m: 1}}/>
                    : (
                        state.running
                            ? <Chip size={"small"} color={"success"} label={"Running"} sx={{m: 1}}/>
                            : <Chip size={"small"} color={"default"} label={"Paused"} sx={{m: 1}}/>
                    )
                }
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

function MixMachineView({mix, mixProgram, sx}: MixMachineViewProps) {
    const [state, setState] = useState(mix.state);
    useEffect(() => {
        mix.onStateChange((e) => {
            setState(e.state);
        });
    }, []);

    return (<BoxViewSection sx={sx}>
        {state.error && <Alert variant={"filled"} color={"error"} title={state.error}/>}
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
    </BoxViewSection>)
}

const extensions = [
    keymap.of(emacsStyleKeymap),
    lineNumbers(),
    EditorView.theme({
        "&": {height: "100%", width: '100%', maxWidth: '100%'},
        ".cm-scroller": {overflow: "auto"}
    }),
];

interface MixAsmEditorProps {
    onCompile: (_: MixProgram) => void;
    mix: MixEmulator;
    sx?: SxProps<Theme> | undefined;
}

function MixAsmEditor({onCompile, mix, sx}: MixAsmEditorProps) {
    const [code, setCode] = useState(tableOfPrimes);
    const [state, setState] = useState(mix.state);
    useEffect(() => {
        mix.onStateChange(e => setState(e.state));
    }, []);

    const startCompile = useCallback(() => {
        return setTimeout(() => {
            const p = compile(code);
            onCompile(p);
        });
    }, [code]);

    useEffect(() => {
        const t = startCompile();
        return () => clearTimeout(t);
    }, [code]);

    return (<BoxViewSection sx={sx}>
        <Box sx={{flexDirection: 'row', display: 'flex', height: '24px'}}>
            <Button disabled={state.running} onClick={() => {
                startCompile();
            }}>
                Compile
            </Button>
        </Box>
        <Divider/>
        <CodeMirror style={{fontSize: '0.8rem', flexGrow: 1, height: 'calc(100% - 30px)'}}
                    value={code}
                    extensions={extensions}
                    onChange={(value) => {
                        setCode(value);
                    }}
        />
    </BoxViewSection>)
}

function MixProgramSection({section, pc, mix}: { section: MixSection, pc: number, mix: MixEmulator }) {
    const [profile, setProfile] = useState<Record<number, number>>({});
    const dataAndSource = useMemo(() =>
        section.data.map((_, i) => {
            return {
                label: formatNumber(section.offset + i, 4),
                addr: section.offset + i,
                source: section.lines[i],
                mixMemoryWord: mix.memory.at(section.offset + i)
            };
        }), [section]);
    const lines = useMemo(() => {
        return dataAndSource.map(line => {
            const {label, addr, source, mixMemoryWord} = line;
            const execCount = profile[addr] || 0;
            const cur = pc === addr;
            return <TableRow
                key={label}
                sx={{
                    backgroundColor: cur ? lightBlue[100] : 'auto',
                    cursor: 'pointer',
                    '&:hover .cell': {
                        backgroundColor: yellow[100],
                        transition: 'background-color 0',
                    },
                    '.cell': {
                        transition: 'background-color 1000ms',
                    },
                    '&:hover .label': {
                        fontWeight: 'bold'
                    },
                    transition: 'background-color 500ms',
                }}
                onMouseOver={() => {
                    mixMemoryWord.setAttr('focus', true);
                }}
                onMouseOut={() => {
                    mixMemoryWord.setAttr('focus', false);
                }}>
                <TableCell className={"cell"} align={'left'}
                           sx={{paddingLeft: '4px', whiteSpace: 'pre', fontFamily: "monospace"}}>
                    {cur ? ">" : " "}{execCount.toString().padEnd(6, ' ')}</TableCell>
                <TableCell className={"cell"} align={'right'} sx={{paddingRight: '4px'}}>
                    <Typography className={"label"} variant={"caption"}>{label}</Typography>
                </TableCell>
                <TableCell className={"cell"} sx={{paddingLeft: '4px'}}>
                    <MixWordValue word={mixMemoryWord}/>
                </TableCell>
                <TableCell className={"cell"} align={'right'} sx={{paddingRight: '4px'}}>
                    {formatNumber(source.lineNo, 0)}
                </TableCell>
                <TableCell className={"cell"} sx={{paddingRight: '4px', fontFamily: "monospace"}} align={"right"}>
                    {source.loc}
                </TableCell>
                <TableCell className={"cell"} sx={{paddingLeft: '4px', fontFamily: "monospace"}}>
                    {source.op}
                </TableCell>
                <TableCell className={"cell"} sx={{paddingLeft: '4px', fontFamily: "monospace", whiteSpace: "pre"}}>
                    {source.addr}
                </TableCell>
            </TableRow>
        });
    }, [dataAndSource, profile, pc]);
    useEffect(() => {
        mix.onStateChange((e) => setProfile(e.state.profile));
    }, []);
    return (<TableBody>{lines}</TableBody>);
}

interface MixProgramViewProps {
    mix: MixEmulator;
    mixProgram: MixProgram | null;
    sx?: SxProps<Theme> | undefined;
}

function MixProgramView({mix, mixProgram, sx}: MixProgramViewProps) {
    const [pc, setPc] = useState(mix.pc);
    useEffect(() => {
        mix.onStateChange((e) => {
            setPc(e.state.pc);
        });
    }, []);
    return (<BoxViewSection sx={sx}>
        <TableContainer sx={{overflowY: 'auto', flexGrow: '1'}}>
            <Table size={"small"} stickyHeader={true} padding={"none"}>
                <TableHead>
                    <TableRow sx={{fontWeight: "bold"}}>
                        <TableCell align={"right"}></TableCell>
                        <TableCell align={"right"} sx={{paddingRight: '4px'}}>Address</TableCell>
                        <TableCell align={"left"} sx={{paddingLeft: '4px'}}>Value</TableCell>
                        <TableCell align={"right"} sx={{paddingRight: '4px'}}>Line No</TableCell>
                        <TableCell align={"right"} sx={{paddingRight: '4px'}}>LOC</TableCell>
                        <TableCell align={"left"} sx={{paddingLeft: '4px'}}>OP</TableCell>
                        <TableCell align={"left"} sx={{paddingLeft: '4px'}}>ADDR</TableCell>
                    </TableRow>
                </TableHead>
                {mixProgram && mixProgram.sections.map(section =>
                    <MixProgramSection mix={mix} key={section.offset} section={section} pc={pc}/>)}
            </Table>
        </TableContainer>
    </BoxViewSection>)
}

interface MixDevicesViewProps {
    devices: MixDevice[];
    sx?: SxProps<Theme> | undefined;
}

function MixDeviceView({device}: { device: MixDevice }) {
    const [lines, setLines] = useState<string[]>([]);
    useEffect(() => {
        device.onOutput((e) => {
            if (e.lines) {
                setLines(prev => [...prev, ...e.lines || []]);
            }
        });
        device.onIoc((_) => {
            setLines([]);
        })
    }, []);
    return (<Box sx={{
        overflowY: 'scroll',
        maxHeight: '100%',
    }}>
        {lines.map((line, i) => <Box key={i} sx={{whiteSpace: 'pre'}}>{line}</Box>)}
    </Box>)
}

interface MixDevicesByTypePanel {
    deviceType: MixDeviceType,
    activeDeviceType: MixDeviceType,
    devices: MixDevice[]
}

function MixDevicesByTypePanel({deviceType, activeDeviceType, devices}: MixDevicesByTypePanel) {
    return (<Box hidden={activeDeviceType !== deviceType} sx={{backgroundColor: yellow[50], flexGrow: 1, maxHeight: '100%'}}>
        {devices.map((device, i) => <MixDeviceView key={i} device={device}/>)}
    </Box>);
}

function MixDevicesView({devices, sx}: MixDevicesViewProps) {
    const [activeDeviceType, setActiveDeviceType] = useState(MixDeviceType.PRINTER);

    const devicesByType = useMemo(() => {
        const map: Record<MixDeviceType, MixDevice[]> = {
            CARD_PUNCHER: [],
            CARD_READER: [],
            DISK: [],
            PAPER_TAPE: [],
            PRINTER: [],
            TAPE: [],
            TYPEWRITER: []
        };
        for (const device of devices) {
            map[device.type].push(device);
        }
        return map;
    }, [devices]);
    const deviceTypeTabs = useMemo(() => {
        return [
            [MixDeviceType.TYPEWRITER, TtyIcon],
            [MixDeviceType.PRINTER, <PrintIcon/>],
            //[MixDeviceType.CARD_PUNCHER, undefined],
            //[MixDeviceType.CARD_READER, undefined],
            //[MixDeviceType.PAPER_TAPE, undefined],
            //[MixDeviceType.TAPE, undefined],
            //[MixDeviceType.DISK, <SaveIcon/>],
        ].map(([deviceType, icon], i) =>
            <Tab key={i} sx={{
                fontSize: '0.8rem',
                '&.MuiTab-root': {
                    alignItems: 'flex-end',
                    padding: '4px 8px',
                    minHeight: 'auto',
                    minWidth: 'auto',
                }
            }} icon={icon} value={deviceType}/>
        )
    }, []);
    const deviceTypePanels = useMemo(() => {
        return [
            MixDeviceType.TYPEWRITER,
            MixDeviceType.PRINTER
        ].map((deviceType) => {
            return <MixDevicesByTypePanel
                key={deviceType}
                deviceType={deviceType}
                devices={devicesByType[deviceType]}
                activeDeviceType={activeDeviceType}/>
        })
    }, [devicesByType, activeDeviceType]);

    return (<BoxViewSection sx={sx}>
        <Box sx={{
            display: 'flex', flexGrow: 1,
            maxHeight: '100%',
        }}>
            <Tabs sx={{
                minHeight: 'auto',
                borderRight: 1,
                borderColor: 'divider',
            }}
                  value={activeDeviceType}
                  orientation={'vertical'}
                  onChange={(_, newValue) => setActiveDeviceType(newValue)}>
                {deviceTypeTabs}
            </Tabs>
            {deviceTypePanels}
        </Box>
    </BoxViewSection>);
}

export function MixEmulatorApp() {
    const mix = useMemo(() => new MixEmulator(), []);
    const [mixProgram, setMixProgram] = useState<MixProgram | null>(null);
    const [devicesHeight] = useState(340); // px

    useEffect(() => {
        if (mixProgram !== null) {
            mix.loadProgram(mixProgram);
        }
    }, [mixProgram]);

    const mainUIMaxHeight = `calc(100% - ${devicesHeight + 40}px)`;

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
                    sx={{flexGrow: 2, minWidth: '25%'}}
                    mix={mix}
                    mixProgram={mixProgram}/>
                <MixMachineView
                    sx={{flexGrow: 2}}
                    mix={mix} mixProgram={mixProgram}/>
            </Stack>

            <Box sx={{
                height: `${devicesHeight}px`,
                display: 'flex',
                flexDirection: 'column',
            }}>
                <MixDevicesView devices={mix.devices} sx={{flexGrow: '1', maxHeight: '100%'}}/>
            </Box>
        </Container>
    )
}