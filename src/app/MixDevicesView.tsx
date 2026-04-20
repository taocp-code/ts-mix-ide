import React, {useEffect, useMemo, useState} from "react";
import {Box, type SxProps, Tab, Tabs, type Theme} from "@mui/material";
import PrintIcon from '@mui/icons-material/Print';
import {yellow} from "@mui/material/colors";
import {type MixDevice} from "../emulator/mix-io.ts";
import {MixDeviceType} from "../emulator/io/mix-device.ts";

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
    return (<Box hidden={activeDeviceType !== deviceType}
                 sx={{backgroundColor: yellow[50], flexGrow: 1, maxHeight: '100%'}}>
        {devices.map((device, i) => <MixDeviceView key={i} device={device}/>)}
    </Box>);
}

export function MixDevicesView({devices, sx}: MixDevicesViewProps) {
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
            // [MixDeviceType.TYPEWRITER, TtyIcon],
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
                },
                '&:hover': {
                    backgroundColor: "lightblue"
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

    return (
        <Box sx={{
            display: 'flex', flexGrow: 1,
            maxHeight: '100%',
            ...sx
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
        </Box>);
}