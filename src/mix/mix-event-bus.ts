import {type MixWordChangeEvent} from "./mix-word.ts";

export interface MixEventTypes {
    'word:change': MixWordChangeEvent;
}

export class MixEventBus {
    private _listeners: Map<keyof MixEventTypes, Function[]> = new Map();

    public on<K extends keyof MixEventTypes>(eventName: K, listener: (e: MixEventTypes[K]) => void) {
        if (!this._listeners.has(eventName)) this._listeners.set(eventName, []);
        this._listeners.get(eventName)!.push(listener);
    }

    public emit<K extends keyof MixEventTypes>(eventName: K, e: MixEventTypes[K]) {
        if (this._listeners.has(eventName)) {
            this._listeners.get(eventName)!.forEach(l => l(e));
        }
    }
}

export const MIX_EVENT_BUS = new MixEventBus();