import {createRoot} from "react-dom/client";
import {MixEmulatorApp} from "./MixEmulatorApp.tsx";
import React from "react";

const root = createRoot(
    document.getElementById('app')!
);
root.render(<MixEmulatorApp/>);