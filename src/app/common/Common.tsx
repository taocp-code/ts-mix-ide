import {styled} from "@mui/material/styles";
import {Box, type BoxProps} from "@mui/material";

export const PanelBox = styled(Box)<BoxProps>(() => ({
    borderRadius: 1,
    border: 'silver solid 1px',
    padding: 1,
    margin: 1,
    display: 'flex',
    flexDirection: 'column',
}));
export const MonospacedBox = styled(Box)<BoxProps>(() => ({
    padding: '2px',
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    transition: 'color 1000ms'
}));