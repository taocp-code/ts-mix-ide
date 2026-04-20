import type {MixProgram, MixSection} from "../emulator/mix-asm.ts";
import {MixEmulator} from "../emulator/mix-emulator.ts";
import React, {useEffect, useMemo, useState} from "react";
import {formatNumber} from "../emulator/utils.ts";
import {
    Box,
    Stack,
    type SxProps,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    type Theme,
    Typography
} from "@mui/material";
import {lightBlue, red, yellow} from "@mui/material/colors";
import {MixWordValue} from "./MixWord.tsx";
import {PanelBox} from "./Common.tsx";
import ForwardIcon from '@mui/icons-material/Forward';
import CircleIcon from '@mui/icons-material/Circle';

function MixProgramSectionView({section, pc, mix}: { section: MixSection, pc: number, mix: MixEmulator }) {
    const [profile, setProfile] = useState<Record<number, number>>({});
    const [breakPoints, setBreakPoints] = useState<Set<number>>(new Set<number>());
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
            const isBreakpoint = breakPoints.has(addr);
            return <TableRow
                key={label}
                sx={{
                    backgroundColor: cur ? lightBlue[100] : 'auto',
                    cursor: 'pointer',
                    '&:hover .cell': {
                        backgroundColor: yellow[100],
                        transition: 'background-color 0',
                    },
                    '& .cell': {
                        transition: 'background-color 100ms',
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
                }}
                onClick={() => {
                    setBreakPoints((prevState) => {
                        if (prevState.has(addr)) {
                            prevState.delete(addr);
                            mix.removeBreakpoint(addr);
                        } else {
                            prevState.add(addr);
                            mix.addBreakpoint(addr);
                        }
                        return new Set<number>(prevState);
                    });
                }}>
                <TableCell className={"cell"} align={'left'}
                           sx={{paddingLeft: '4px', whiteSpace: 'pre', fontFamily: "monospace"}}>
                    {execCount.toString().padEnd(6, ' ')}
                </TableCell>
                <TableCell className={"cell"} align={'right'} sx={{paddingRight: '4px'}}>
                    <Stack direction={"row"} sx={{borderLeft: 1, borderRight: 1, borderColor: 'divider'}}>
                        <Box sx={{
                            display: 'grid',
                            justifyItems: 'center',
                            alignItems: 'center',
                            '& *': {gridColumnStart: 1, gridRowStart: 1}
                        }}>
                            <CircleIcon sx={{color: red[700], transform: 'scale(0.8)'}} fontSize={"small"}
                                        visibility={isBreakpoint ? 'visible' : 'hidden'}/>
                            <ForwardIcon sx={{color: yellow[700], transform: 'scale(0.9)'}} fontSize={"small"}
                                         visibility={cur ? 'visible' : 'hidden'}/>
                        </Box>
                        <Typography className={"label"} variant={"caption"}>
                            {label}
                        </Typography>
                    </Stack>
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
    }, [dataAndSource, profile, pc, breakPoints]);
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

export function MixProgramView({mix, mixProgram, sx}: MixProgramViewProps) {
    const [pc, setPc] = useState(mix.pc);
    useEffect(() => {
        mix.onStateChange((e) => {
            setPc(e.state.pc);
        });
    }, []);
    return (<PanelBox sx={sx}>
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
                    <MixProgramSectionView mix={mix} key={section.offset} section={section} pc={pc}/>)}
            </Table>
        </TableContainer>
    </PanelBox>)
}