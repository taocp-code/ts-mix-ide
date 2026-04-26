import React, {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {MixEmulatorApp} from "./MixEmulatorApp.tsx";
import {CssBaseline} from "@mui/material";

const root = createRoot(
    document.getElementById('app')!
);
root.render(
    <StrictMode>
        <CssBaseline/>
        <MixEmulatorApp/>
    </StrictMode>
);