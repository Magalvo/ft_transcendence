import { AbstractComponent } from '../../core/Component';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import Hyperspeed from '../react/Hyperspeed';
import { hyperspeedPresets } from '../react/HyperspeedPresets';

export class HyperspeedWrapper extends AbstractComponent {
    private reactRoot: Root | null = null;
    private preset: any;

    constructor(preset = hyperspeedPresets.one) {
        super('div', 'fixed top-0 left-0 w-full h-full -z-10 bg-black');
        this.preset = preset;
    }

    public render(): void {
        this.reactRoot = createRoot(this.element);

        this.reactRoot.render(
            React.createElement(Hyperspeed, { effectOptions: this.preset })
        );
    }

    public onDestroy(): void {
        if (this.reactRoot) {
            this.reactRoot.unmount();
            this.reactRoot = null;
        }
    }
}