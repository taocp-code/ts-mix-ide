import React, {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {MixEmulatorApp} from "./app/MixEmulatorApp.tsx";
import {CssBaseline} from "@mui/material";

const root = createRoot(
    document.getElementById('app')!
);
root.render(
    <StrictMode>
        <React.Fragment>
            <CssBaseline/>
            <MixEmulatorApp/>
        </React.Fragment>
    </StrictMode>
);