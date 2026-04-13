import React, {useEffect, useState} from "react";
import {MixEmulator} from "./mix/mix-emulator.ts";
import {
    Box,
    type BoxProps,
    Button,
    Container,
    Divider,
    Grid,
    IconButton,
    Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Tooltip,
    Typography
} from "@mui/material";
import CodeMirror from '@uiw/react-codemirror';
import {keymap, lineNumbers} from "@codemirror/view";
import {emacsStyleKeymap} from "@codemirror/commands";
import {compile, type MIXProgram, type MIXSection} from "./mix/mix-asm.ts";
import {MixWord} from "./mix/mix-word.ts";
import tableOfPrimes from "./mix-programs/table-of-primes.mixal?raw";
import {formatBoolean, formatNumber, formatSign} from "./mix/utils.ts";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RedoIcon from '@mui/icons-material/Redo';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {styled} from "@mui/material/styles";

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

const MonospacedBox = styled(Box)<BoxProps>(()=>({
        padding: '2px',
        fontFamily: 'monospace'
}));

function MixByte({v}: {v: number}) {
    return <MonospacedBox>{formatNumber(v, 2)}</MonospacedBox>
}

function RenderMixWordValue({word}: {word: MixWord}) {
    const left = word.left;
    const [w, setW] = useState(new MixWord(word.value));
    useEffect(() => {
        word.onChange((e) => {
            setW(new MixWord(e.word.value));
        })
    });
    return <Box
        sx={{
            flexDirection: 'row',
            display: 'flex',
            borderWidth: 1,
            borderColor: "silver",
            borderStyle: 'solid',
            width: '120px'}}>
        <MonospacedBox>{formatSign(w.sign)}</MonospacedBox>
        {left <= 1 && <MixByte v={w.getByte(1)}/>}
        {left <= 2 && <MixByte v={w.getByte(2)}/>}
        {left <= 3 && <MixByte v={w.getByte(3)}/>}
        {left <= 4 && <MixByte v={w.getByte(4)}/>}
        {left <= 5 && <MixByte v={w.getByte(5)}/>}
    </Box>
}

function RenderMixWord({word}: {word: MixWord}) {
    return <Box sx={{p: 1}}>
        <Box>{word.label}</Box>
        <RenderMixWordValue word={word}/>
    </Box>
}

function RenderMixState({mix}: {mix: MixEmulator}) {
    const [state, setState] = useState({pc: mix.pc, compare: mix.compare, overflow: mix.overflow, halt: mix.halt});
    useEffect(() => {
        mix.onStateChange((e) => {
            setState(e.newState);
        });
    }, []);
    return <Box
        sx={{flexDirection: 'row', display: 'flex'}}
    >
        <Box sx={{p: 1}}>
            <Box>Program Counter</Box>
            <Box sx={{borderWidth: 1, borderColor: "black", borderStyle: 'solid', p: 1}}>
                {formatNumber(state.pc, 4)}
            </Box>
        </Box>
        <Box sx={{p: 1}}>
            <Box>Overflow</Box>
            <Box sx={{borderWidth: 1, borderColor: "black", borderStyle: 'solid', p: 1}}>
                {formatBoolean(state.overflow)}
            </Box>
        </Box>
        <Box sx={{p: 1}}>
            <Box>Compare</Box>
            <Box sx={{borderWidth: 1, borderColor: "black", borderStyle: 'solid', p: 1}}>
                {state.compare === 1 ? "GREATER" : (state.compare === -1 ? 'LESS' : 'EQUAL')}
            </Box>
        </Box>
        <Box sx={{p: 1}}>
            <Box>Halt</Box>
            <Box sx={{borderWidth: 1, borderColor: "black", borderStyle: 'solid', p: 1}}>
                {formatBoolean(state.halt, 'Halted', 'Running')}
            </Box>
        </Box>
    </Box>
}

function RenderMixMemory({mix}: {mix: MixEmulator}) {
    const words: MixWord[] = [];
    for (const w of mix.memory) {
        words.push(w);
    }
    return <Grid sx={{p: 1}} container={true} spacing={1}>
        {words.map((w) => {
            return (<Box key={w.label}>
                <Typography>{w.label}</Typography>
                <RenderMixWordValue word={w}/>
            </Box>)
        })}
    </Grid>
}

function MixMachineView({mix, mixProgram}: {mix: MixEmulator, mixProgram: MIXProgram|null}) {
    const [running, setRunning] = useState(false);
    const [timer, setTimer] = useState<any>(null);

    useEffect(() => {
        if (running) {
            if (timer === null) {
                const run = () => {
                    if (mix.halt) {
                        setRunning(false);
                        return;
                    }
                    mix.step();
                };
                const t = setInterval(run, 1);
                setTimer(t);
                return () => {
                    clearInterval(t);
                    setTimer(null);
                }
            }
        } else {
            if (timer !== null){
                clearInterval(timer);
                setTimer(null);
            }
        }
    }, [running, timer]);

    return (<BoxViewSection>
        <Box sx={{flexDirection: 'row', display: 'flex'}}>
            <Tooltip title={'Step'}>
                <IconButton sx={{color: 'blue'}} onClick={() => {
                    mix.step();
                }}><RedoIcon/></IconButton>
            </Tooltip>
            <Tooltip title={running ? 'Stop' : 'Run'}>
                <IconButton sx={{color: running ? 'red' : 'green'}} onClick={() => {
                    setRunning(!running);
                }}>{running ? <StopIcon/> : <PlayArrowIcon/>}</IconButton>
            </Tooltip>
            <Tooltip title={"Reset"}>
                <IconButton sx={{color: 'maroon'}} onClick={() => {
                    mix.reset();
                    if (mixProgram !== null) {
                        mix.loadProgram(mixProgram);
                    }
                }}><RestartAltIcon/></IconButton>
            </Tooltip>
        </Box>
        <Box sx={{flexDirection: 'row', display: 'flex'}}>
            <RenderMixWord word={mix.rA}/>
            <RenderMixWord word={mix.rX}/>
        </Box>
        <Box sx={{flexDirection: 'row', display: 'flex'}}>
            <RenderMixWord word={mix.rI1}/>
            <RenderMixWord word={mix.rI2}/>
            <RenderMixWord word={mix.rI3}/>
            <RenderMixWord word={mix.rI4}/>
            <RenderMixWord word={mix.rI5}/>
            <RenderMixWord word={mix.rI6}/>
            <RenderMixWord word={mix.rJ}/>
        </Box>
        <Box>
            <RenderMixState mix={mix}/>
        </Box>
        <Divider></Divider>
        <Box sx={{maxHeight: '800px', overflowY: 'auto'}}>
            <RenderMixMemory mix={mix}/>
        </Box>
    </BoxViewSection>)
}

function MixAsmEditor(props: {onCompile: (_: MIXProgram)=>void}) {
    const [code, setCode] = useState(tableOfPrimes);
    return (<BoxViewSection>
        <Box sx={{flexDirection: 'row', display: 'flex'}}>
            <Button onClick={() => {
                const p = compile(code);
                props.onCompile(p);
            }}>
                Compile
            </Button>
        </Box>
        <CodeMirror value={code}
                    extensions={[keymap.of(emacsStyleKeymap), lineNumbers()]}
                    height={'auto'}
                    minHeight={'800px'}
                    onChange={(value) => {
                        setCode(value);
                    }}
        />
    </BoxViewSection>)
}

function MixProgramSection({section, pc}: {section: MIXSection, pc: number}) {
    const dataAndSource = section.data.map((w, i) => {
        return {label: formatNumber(section.offset + i, 4), addr: section.offset + i, word: w, source: section.lines[i]};
    });
    console.log('mix program section render!')
    return (
        <TableBody>
        {dataAndSource.map((line) => {
            const {label, addr, word, source} = line;
            const cur = pc === addr;
            return <TableRow key={label} sx={{backgroundColor: cur ? 'silver' : 'auto'}}>
                <TableCell>{cur ? ">" : ""}</TableCell>
                <TableCell align={'right'}>
                    {label}
                </TableCell>
                <TableCell align={'left'}>
                    <RenderMixWordValue word={word}/>
                </TableCell>
                <TableCell align={'right'}>{formatNumber(source.lineNo, 4)}</TableCell>
                <TableCell sx={{whiteSpace: 'pre'}}>
                    {source.loc}
                </TableCell>
                <TableCell sx={{whiteSpace: 'pre'}}>
                    {source.op}
                </TableCell>
                <TableCell sx={{whiteSpace: 'pre'}}>
                    {source.addr}
                </TableCell>
            </TableRow>
        })}
        </TableBody>)
}

function MixProgramView({mix, mixProgram}: {mix: MixEmulator, mixProgram: MIXProgram|null}) {
    const [pc, setPc] = useState(mix.pc);
    mix.onStateChange((e) => {
        setPc(e.newState.pc);
    })
    return (<BoxViewSection>
        <TableContainer sx={{overflowY: 'auto', maxHeight: '80vh'}}>
            <Table size={"small"} stickyHeader={true}>
            <TableHead>
                <TableRow>
                    <TableCell></TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Line No</TableCell>
                    <TableCell colSpan={3}>Source</TableCell>
                </TableRow>
            </TableHead>
            {mixProgram && mixProgram.sections.map(section => <MixProgramSection key={section.offset} section={section} pc={pc}/>)}
        </Table>
        </TableContainer>
    </BoxViewSection>)
}

export function MixEmulatorApp() {
    const [mix] = useState(new MixEmulator());
    const [mixProgram, setMixProgram] = useState<MIXProgram|null>(null);

    useEffect(() => {
        if (mixProgram !== null) {
            mix.loadProgram(mixProgram);
        }
    }, [mixProgram]);

    return (
        <Container sx={{width: '100%', maxHeight: '800px'}} maxWidth={false}>
            <Typography variant={'h4'}>The MIX Emulator</Typography>
            <Stack direction={"row"}>
                <MixAsmEditor onCompile={(p)=> setMixProgram(p)}/>
                <MixProgramView mix={mix} mixProgram={mixProgram}/>
                <MixMachineView mix={mix} mixProgram={mixProgram}/>
            </Stack>
        </Container>
    )
}