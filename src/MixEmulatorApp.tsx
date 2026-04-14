import React, {useEffect, useMemo, useState} from "react";
import {MixEmulator} from "./mix/mix-emulator.ts";
import {
    Box,
    type BoxProps,
    Button, Chip,
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
import {compile, type MIXProgram, type MIXSection} from "./mix/mix-asm.ts";
import {MIX_WORD_SIZE, MixWord} from "./mix/mix-word.ts";
import tableOfPrimes from "./mix-programs/table-of-primes.mixal?raw";
import {formatBoolean, formatNumber, formatSign} from "./mix/utils.ts";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FastForwardIcon from '@mui/icons-material/FastForward';
import PauseIcon from '@mui/icons-material/Pause';
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
    }, []);
    return <Box sx={{
            flexDirection: 'row',
            display: 'flex',
            width: `${(2 + MIX_WORD_SIZE - left)*20}px`}}>
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

function MixStateView({mix}: {mix: MixEmulator}) {
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
            <MonospacedBox>
                {formatNumber(state.pc, 4)}
            </MonospacedBox>
        </Box>
        <Box sx={{p: 1}}>
            <Box>Overflow</Box>
            <MonospacedBox>
                {formatBoolean(state.overflow)}
            </MonospacedBox>
        </Box>
        <Box sx={{p: 1}}>
            <Box>Compare</Box>
            <MonospacedBox>
                {state.compare === 1 ? ">" : (state.compare === -1 ? '<' : '=')}
            </MonospacedBox>
        </Box>
        <Box sx={{p: 1}}>
            <Box>Status</Box>
            <MonospacedBox>
                {formatBoolean(state.halt, 'Halted', 'Running')}
            </MonospacedBox>
        </Box>
        <Box sx={{p: 1}}>
            <Box>Cycles</Box>
            <MonospacedBox>
                {mix.cycles}
            </MonospacedBox>
        </Box>
    </Box>
}

function RenderMixMemory({mix, highlightAddress}: {mix: MixEmulator, highlightAddress: number}) {
    const words: MixWord[] = useMemo(() => {
        console.log('building memory view: ')
        const words = [];
        for (const w of mix.memory) {
            words.push(w);
        }
        return words;
    }, [mix]);
    console.log('Highlight address', highlightAddress);

    return <Grid sx={{p: 1}} container={true} spacing={0} columns={1}>
        {words.map((w) => {
            return (<Box key={w.label} sx={{p: '1px'}}>
                <Typography variant={"caption"}>{w.label}</Typography>
                <RenderMixWordValue word={w}/>
            </Box>)
        })}
    </Grid>
}

function MixMachineView({mix, mixProgram, highlightAddress}: {mix: MixEmulator, mixProgram: MIXProgram|null, highlightAddress: number}) {
    const [running, setRunning] = useState(false);
    const [halted, setHalted] = useState(false);
    useEffect(() => {
        mix.onStateChange((e) => {
            setHalted(e.newState.halt);
        })
    }, [mix]);

    return (<BoxViewSection>
        <Box sx={{flexDirection: 'row', display: 'flex'}}>
            <Tooltip title={'Step'}>
                <IconButton sx={{color: 'blue'}} onClick={() => {
                    mix.step();
                }} disabled={running || halted}><RedoIcon/></IconButton>
            </Tooltip>
            <Tooltip title={running ? 'Stop' : 'Run'}>
                <IconButton disabled={halted} sx={{color: running ? 'red' : 'green'}} onClick={() => {
                    if (!running) {
                        setRunning(true);
                        mix.runAsync(50);
                    } else {
                        setRunning(false);
                        mix.stopAsync();
                    }
                }}>{running ? <PauseIcon/> : <PlayArrowIcon/>}</IconButton>
            </Tooltip>
            <Tooltip title={"Fast Run"}>
                <IconButton disabled={running || halted} onClick={() => {
                    mix.run();
                }}><FastForwardIcon/></IconButton>
            </Tooltip>
            <Tooltip title={"Reset"}>
                <IconButton sx={{color: 'maroon'}} onClick={() => {
                    mix.reset();
                    if (mixProgram !== null) {
                        mix.loadProgram(mixProgram);
                    }
                }} disabled={running}><RestartAltIcon/></IconButton>
            </Tooltip>
            {halted && <Chip size={"small"} color={"error"} label={"Halted"} sx={{m: 1}}/>}
        </Box>
        <Box>
            <MixStateView mix={mix}/>
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
        <Divider></Divider>
        <Box sx={{maxHeight: '800px', overflowY: 'auto'}}>
            <RenderMixMemory mix={mix} highlightAddress={highlightAddress}/>
        </Box>
    </BoxViewSection>)
}

const extensions = [keymap.of(emacsStyleKeymap), lineNumbers()];

function MixAsmEditor(props: {onCompile: (_: MIXProgram)=>void, lineNo: number}) {
    const [code, setCode] = useState(tableOfPrimes);
    useEffect(() => {
        const p = compile(code);
        props.onCompile(p);
    }, []);
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
                    extensions={extensions}
                    height={'auto'}
                    minHeight={'800px'}
                    onChange={(value) => {
                        setCode(value);
                    }}
        />
    </BoxViewSection>)
}

function MixProgramSection({section, pc, mix}: {section: MIXSection, pc: number, onHoverLine: (lineNo: number, address: number) => void|undefined, mix: MixEmulator}) {
    const [profile, setProfile] = useState<Record<number, number>>({});
    const dataAndSource = useMemo(() =>
        section.data.map((w, i) => {
            return {
                label: formatNumber(section.offset + i, 4), addr: section.offset + i, word: w, source: section.lines[i]};
        }), [section]);
    useEffect(() => {
        mix.onStateChange((e) => setProfile(e.newState.profile));
    }, []);
    return (
        <TableBody>
        {dataAndSource.map((line) => {
            const {label, addr, word, source} = line;
            const execCount = profile[addr];
            const cur = pc === addr;
            return <TableRow key={label}
                             sx={{backgroundColor: cur ? 'silver' : 'auto', cursor: 'pointer'}}>
                <TableCell>{execCount} {cur ? ">" : ""}</TableCell>
                <TableCell align={'right'} sx={{paddingRight: '4px'}}>
                    {label}
                </TableCell>
                <TableCell sx={{paddingLeft: '4px'}}>
                    <RenderMixWordValue word={word}/>
                </TableCell>
                <TableCell align={'right'} sx={{paddingRight: '4px'}}>
                    {formatNumber(source.lineNo, 4)}
                </TableCell>
                <TableCell sx={{paddingRight: '4px', fontFamily: "monospace"}} align={"right"}>
                    {source.loc}
                </TableCell>
                <TableCell sx={{paddingLeft: '4px', fontFamily: "monospace"}}>
                    {source.op}
                </TableCell>
                <TableCell sx={{paddingLeft: '4px', fontFamily: "monospace", whiteSpace: "pre"}}>
                    {source.addr}
                </TableCell>
            </TableRow>
        })}
        </TableBody>)
}

function MixProgramView({mix, mixProgram, onHoverLine}: {
    mix: MixEmulator, mixProgram: MIXProgram|null, onHoverLine: (lineNo: number, address: number) => void|undefined
}) {
    const [pc, setPc] = useState(mix.pc);
    mix.onStateChange((e) => {
        setPc(e.newState.pc);
    })
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
                <MixProgramSection mix={mix} key={section.offset} section={section} pc={pc} onHoverLine={onHoverLine}/>)}
        </Table>
        </TableContainer>
    </BoxViewSection>)
}

export function MixEmulatorApp() {
    const mix = useMemo(() => new MixEmulator(), []);
    const [mixProgram, setMixProgram] = useState<MIXProgram|null>(null);
    const [hoverLineNo, setHoverLineNo] = useState(-1);
    const [hoverAddr, setHoverAddr] = useState(-1);

    useEffect(() => {
        if (mixProgram !== null) {
            mix.loadProgram(mixProgram);
        }
    }, [mixProgram]);

    return (
        <Container sx={{width: '100%', maxHeight: '800px'}} maxWidth={false}>
            <Typography variant={'h6'}>MIX Playground</Typography>
            <Stack direction={"row"}>
                <MixAsmEditor onCompile={(p)=> setMixProgram(p)} lineNo={hoverLineNo}/>
                <MixProgramView
                    mix={mix}
                    mixProgram={mixProgram}
                    onHoverLine={(lineNo, address) => {
                        setHoverLineNo(lineNo);
                        if (address !== -1) setHoverAddr(address);
                    }}/>
                <MixMachineView mix={mix} mixProgram={mixProgram} highlightAddress={hoverAddr}/>
            </Stack>
        </Container>
    )
}