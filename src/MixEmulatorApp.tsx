import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {MixEmulator, type MixState} from "./mix/mix-emulator.ts";
import {
    Alert,
    Box,
    type BoxProps,
    Button,
    Chip,
    Container,
    Divider,
    Grid,
    IconButton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography
} from "@mui/material";
import CodeMirror from '@uiw/react-codemirror';
import {keymap, lineNumbers} from "@codemirror/view";
import {emacsStyleKeymap} from "@codemirror/commands";
import {compile, type MixProgram, type MixSection} from "./mix/mix-asm.ts";
import {MIX_WORD_SIZE, MixWord} from "./mix/mix-word.ts";
import tableOfPrimes from "./mix-programs/table-of-primes.mixal?raw";
import {formatBoolean, formatNumber, formatSign} from "./mix/utils.ts";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FastForwardIcon from '@mui/icons-material/FastForward';
import PauseIcon from '@mui/icons-material/Pause';
import RedoIcon from '@mui/icons-material/Redo';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {styled} from "@mui/material/styles";
import {lightBlue, purple, yellow} from "@mui/material/colors";

const BoxViewSection = styled(Box)<BoxProps>(() => ({
    width: '50%',
    maxWidth: '50%',
    borderRadius: 1,
    border: 'silver',
    borderStyle: 'solid',
    borderWidth: 1,
    padding: 1,
    margin: 1,
}));

const MonospacedBox = styled(Box)<BoxProps>(() => ({
    padding: '2px',
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    transition: 'color 200ms'
}));

function MixByte({v}: { v: number }) {
    return <MonospacedBox className={"byte"}>{formatNumber(v, 2)}</MonospacedBox>
}

function MixWordValue({word}: { word: MixWord }) {
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
        width: `${(2 + MIX_WORD_SIZE - left) * 24}px`,
        fontWeight: focus ? 'bold' : 'auto',
        '.byte': {color: changed ? yellow[800] : (focus ? purple['800'] : 'auto')},

    }}>
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
    const ref = useRef<HTMLElement | null>(null);
    useEffect(() => {
        word.onChange(e => {
            setFocus((prev) => {
                if (prev === e.word.attrs['focus']) return;
                return e.word.attrs['focus'];
            });
        })
    }, []);
    return <Box
        ref={ref}
        sx={{
            p: 0,
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
        <Typography className={"label"} variant={"caption"}>{word.label}</Typography>
        <MixWordValue word={word}/>
    </Box>
}

function MixStateView({mix}: { mix: MixEmulator }) {
    const [state, setState] = useState<MixState>(mix.state);
    useEffect(() => {
        mix.onStateChange((e) => {
            setState(e.state);
        });
    }, []);
    return <>
        <Box sx={{p: 1}}>
            <Typography variant={"caption"}>Program Counter</Typography>
            <MonospacedBox>
                {formatNumber(state.pc, 4)}
            </MonospacedBox>
        </Box>
        <Box sx={{p: 1}}>
            <Typography variant={"caption"}>Overflow</Typography>
            <MonospacedBox>
                {formatBoolean(state.overflow)}
            </MonospacedBox>
        </Box>
        <Box sx={{p: 1}}>
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
            wordViews.push(<MixWordView word={w}/>);
        }
        return wordViews;
    }, [mix]);
    return <Grid sx={{p: 1}} container={true} spacing={0} columns={1}>
        {children}
    </Grid>
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
        {!halted && <><Tooltip title={'Step'}>
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
                      label={`RTT: ${state.totalRealTime.toFixed(3)}s`} sx={{m: 1}}
                      variant={"outlined"}/>
            </Tooltip>
            <Tooltip title={"Total MIX machine time spent in execution."}>
                <Chip size={"small"} color={"info"} label={`MTT: ${state.totalTime}u`} sx={{m: 1}}
                      variant={"outlined"}/>
            </Tooltip>
            <Tooltip title={"Total instructions executed."}>
                <Chip size={"small"} color={"info"} label={`INS: ${state.instructions}`} sx={{m: 1}}
                      variant={"outlined"}/>
            </Tooltip>
            <Tooltip title={"Instructions per second."}>
                <Chip size={"small"} color={"info"} label={`IPS: ${state.ips.toFixed(1)}`} sx={{m: 1}}
                      variant={"outlined"}/>
            </Tooltip>
        </Box>
    </>;
}

function MixMachineView({mix, mixProgram}: { mix: MixEmulator, mixProgram: MixProgram | null }) {
    const [state, setState] = useState(mix.state);
    useEffect(() => {
        mix.onStateChange((e) => {
            setState(e.state);
        })
    }, []);

    return (<BoxViewSection>
        {state.error && <Alert variant={"filled"} color={"error"} title={state.error}/>}
        <Box sx={{flexDirection: 'row', display: 'flex'}}>
            {<MixMachineController mix={mix} mixProgram={mixProgram}/>}
        </Box>
        <Divider/>
        <Box sx={{flexDirection: 'row', display: 'flex'}}>
            <MixStateView mix={mix}/>
        </Box>
        <Divider/>
        <Box sx={{flexDirection: 'row', display: 'flex', p: 1}}>
            <MixWordView word={mix.rA}/>
            <MixWordView word={mix.rX}/>
        </Box>
        <Box sx={{flexDirection: 'row', display: 'flex', p: 1}}>
            <MixWordView word={mix.rI1}/>
            <MixWordView word={mix.rI2}/>
            <MixWordView word={mix.rI3}/>
            <MixWordView word={mix.rI4}/>
            <MixWordView word={mix.rI5}/>
            <MixWordView word={mix.rI6}/>
            <MixWordView word={mix.rJ}/>
        </Box>
        <Divider/>
        <Box sx={{maxHeight: '800px', overflowY: 'auto'}}>
            <MixMemoryView mix={mix}/>
        </Box>
    </BoxViewSection>)
}

const extensions = [keymap.of(emacsStyleKeymap), lineNumbers()];

interface MixAsmEditorProps {
    onCompile: (_: MixProgram) => void;
    mix: MixEmulator;
}

function MixAsmEditor({onCompile, mix}: MixAsmEditorProps) {
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

    return (<BoxViewSection>
        <Box sx={{flexDirection: 'row', display: 'flex'}}>
            <Button disabled={state.running} onClick={() => {
                startCompile();
            }}>
                Compile
            </Button>
        </Box>
        <CodeMirror value={code}
                    extensions={extensions}
                    height={'auto'}
                    minHeight={'800px'}
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
                        backgroundColor: yellow[100]
                    },
                    '.cell': {
                        transition: 'background-color 500ms',
                    },
                    '&:hover .label': {
                        fontWeight: 'bold'
                    },
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

function MixProgramView({mix, mixProgram}: {
    mix: MixEmulator, mixProgram: MixProgram | null
}) {
    const [pc, setPc] = useState(mix.pc);
    useEffect(() => {
        mix.onStateChange((e) => {
            setPc(e.state.pc);
        });
    }, []);
    return (<BoxViewSection>
        <TableContainer sx={{overflowY: 'auto', maxHeight: '80vh'}}>
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

export function MixEmulatorApp() {
    const mix = useMemo(() => new MixEmulator(), []);
    const [mixProgram, setMixProgram] = useState<MixProgram | null>(null);

    useEffect(() => {
        if (mixProgram !== null) {
            mix.loadProgram(mixProgram);
        }
    }, [mixProgram]);

    return (
        <Container sx={{width: '100%', maxHeight: '800px'}} maxWidth={false}>
            <Typography variant={'h6'}>MIX Playground</Typography>
            <Stack direction={"row"}>
                <MixAsmEditor onCompile={(p) => setMixProgram(p)} mix={mix}/>
                <MixProgramView
                    mix={mix}
                    mixProgram={mixProgram}/>
                <MixMachineView mix={mix} mixProgram={mixProgram}/>
            </Stack>
        </Container>
    )
}