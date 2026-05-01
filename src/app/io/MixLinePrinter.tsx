import React, {useCallback, useEffect, useState} from "react";
import {Box, Paper} from "@mui/material";
import type {MixCommonDeviceViewProps} from "./MixDevicesView.tsx";

export type MixLinePrinterProps = {} & MixCommonDeviceViewProps;

export interface Page {
    lines: string[];
}

function PageView({page}: { page: Page }) {
    const fontFamily = 'LinePrinter';
    return <Paper elevation={3} sx={{
        maxWidth: '90%',
        minWidth: '210mm',
        minHeight: '297mm',
        width: 'fit-content',
        marginLeft: 'auto',
        marginRight: 'auto',
        marginTop: 4,
        marginBottom: 4,
        display: 'flex',
        justifyItems: 'center',
        flexDirection: 'column',
        padding: '4em',
    }}>
        {page.lines?.map((line, no) => {
            return <Box key={no} sx={{
                width: 'fit-content',
                whiteSpace: "pre",
                fontFamily: fontFamily,
            }}>{line}</Box>
        })}
    </Paper>
}

export function MixLinePrinter({connection}: MixLinePrinterProps) {
    const [, setPages] = useState<Page[]>([]);
    const [curPage, setCurPage] = useState<Page | null>(null);
    const onNewPage = useCallback(async (): Promise<void> => {
        setCurPage(prevPage => {
            if (prevPage) {
                setPages(pages => [...pages, prevPage]);
            }
            return {lines: []};
        });
    }, []);
    const textSink = useCallback(async (text: string): Promise<void> => {
        setCurPage(prev => {
            const lines = [...(prev?.lines || []), text];
            return {lines};
        });
        console.log('Updated lines state');
    }, []);
    useEffect(() => {
        connection.setIocHandler(onNewPage);
        connection.setTextSink(textSink);
    }, [onNewPage, textSink]);
    return (<Box>
        {curPage && <PageView page={curPage}/>}
    </Box>);
}