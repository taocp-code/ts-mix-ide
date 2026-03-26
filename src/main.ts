import './style.css'
import {Mix} from "./mix/mix.ts";

let mix: Mix = new Mix();

function init() {
    mix.reset();
}

document.onload = () => init();

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `

`