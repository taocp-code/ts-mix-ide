import React, {useEffect, useState} from "react";
import {MixEmulator} from "./mix/mix-emulator.ts";
import {Box, Button, Container, Divider, Grid, Stack, Typography} from "@mui/material";
import CodeMirror from '@uiw/react-codemirror';
import {keymap, lineNumbers} from "@codemirror/view";
import {emacsStyleKeymap} from "@codemirror/commands";
import {compile} from "./mix/mix-asm.ts";
import {MixWord} from "./mix/mix-word.ts";
import tableOfPrimes from "./mix-programs/table-of-primes.mixal?raw";

function MixByte({v}: {v: number}) {
    return <Box sx={{p: 1}}>{v.toString().padStart(2, '0')}</Box>
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
        sx={{flexDirection: 'row', display: 'flex', borderWidth: 1, borderColor: "black", borderStyle: 'solid',
        width: 'auto'}}>
        <Box sx={{p: 1}}>{w.sign === 1 ? '+' : '-'}</Box>
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
                {state.pc.toString().padStart(4, '0')}
            </Box>
        </Box>
        <Box sx={{p: 1}}>
            <Box>Overflow</Box>
            <Box sx={{borderWidth: 1, borderColor: "black", borderStyle: 'solid', p: 1}}>
                {state.overflow ? "Yes" : "No"}
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
                {state.halt ? 'Yes' : 'No'}
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

function MixEmulatorUI({mix}: {mix: MixEmulator}) {
    return (<Box sx={{
        width: '50%',
        borderRadius: 1,
        border: 'silver',
        borderStyle: 'solid',
        borderWidth: 1,
        padding: 1,
        margin: 1,
    }}>
        <Box sx={{flexDirection: 'row', display: 'flex'}}>

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
    </Box>)
}

function MixAsmEditor(props: {mix: MixEmulator}) {
    const mix = props.mix;
    const [program, setProgram] = useState(tableOfPrimes);
    return (<Box sx={{
        width: '50%',
        borderRadius: 1,
        border: 'silver',
        borderStyle: 'solid',
        borderWidth: 1,
        padding: 1,
        margin: 1,
    }}>
        <Box sx={{flexDirection: 'row', display: 'flex'}}>
            <Button onClick={() => {
                const p = compile(program);
                mix.reset();
                mix.loadProgram(p);
            }}>
                Compile
            </Button>
            <Button onClick={() => {
                mix.step();
            }}>Step</Button>
            <Button onClick={() => {
                const p = compile(program);
                mix.reset();
                mix.loadProgram(p);
                mix.run();
            }}>Compile & Run</Button>
            <Button onClick={() => {
                mix.reset();
            }}>
                Reset
            </Button>

        </Box>
        <CodeMirror value={program}
                    extensions={[keymap.of(emacsStyleKeymap), lineNumbers()]}
                    height={'auto'}
                    minHeight={'800px'}
                    onChange={(value) => {
                        setProgram(value);
                    }}
        />
    </Box>)
}

export function MixEmulatorApp() {
    const [mix] = useState(new MixEmulator());

    return (
        <Container sx={{width: '100%', maxHeight: '800px'}} maxWidth={false}>
            <Typography variant={'h4'}>The MIX Emulator</Typography>
            <Stack direction={"row"}>
                <MixAsmEditor mix={mix}/>
                <MixEmulatorUI mix={mix}/>
            </Stack>
        </Container>
    )
}