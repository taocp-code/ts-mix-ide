import {MonospacedBox} from "./Common.tsx";
import {formatNumber, formatSign} from "../emulator/utils.ts";
import React, {useEffect, useRef, useState} from "react";
import {MixWord} from "../emulator/mix-word.ts";
import {Box, Paper} from "@mui/material";
import {purple, red, yellow} from "@mui/material/colors";

function MixByte({v}: { v: number }) {
    return <MonospacedBox className={"byte"}>{formatNumber(v, 2)}</MonospacedBox>
}

export function MixWordValue({word, showLabel}: { word: MixWord, showLabel?: boolean }) {
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

export function MixWordView({word}: { word: MixWord, hideInitially?: boolean }) {
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