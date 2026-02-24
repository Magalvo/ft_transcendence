import { AbstractComponent } from '../../core/Component';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { GridScan } from '../react/GridScan'; // Import the component

export class GridScanWrapper extends AbstractComponent {
    private reactRoot: Root | null = null;
    private props: any;

    constructor(props: any = {}) {
        // Fullscreen container, behind content (-z-10)
        super('div', 'fixed top-0 left-0 w-full h-full -z-10 bg-black');
        
        // Default props matching your desired look
        this.props = {
            enableWebcam: true,      // Set to true if you want the face tracking
            enablePost: true,
            scanColor: '#FF9FFC',
            linesColor: '#5227FF',
            gridScale: 0.1,
            scanDirection: 'backward',
            scanDuration: 1.5,
            lineJitter: 0.1,
            ...props // Allow overriding defaults
        };
    }

    public render(): void {
        this.reactRoot = createRoot(this.element);
        this.reactRoot.render(
            React.createElement(GridScan, this.props)
        );
    }

    public onDestroy(): void {
        if (this.reactRoot) {
            this.reactRoot.unmount();
            this.reactRoot = null;
        }
    }
}