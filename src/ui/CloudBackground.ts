import { Container, Sprite } from 'pixi.js';
import { app } from '../main';

/**
 * Animated cloud background with alternating full-screen cloud sprites moving horizontally
 */
export class CloudBackground extends Container {
    /** Speed of cloud movement (pixels per frame) */
    public speed = 1;
    /** Array to hold all cloud sprites */
    private clouds: Sprite[] = [];
    /** Width of each cloud sprite (full screen width) */
    private cloudWidth = 0;

    constructor() {
        super();

        // Create initial clouds to fill the screen plus buffer
        this.createInitialClouds();

        this.onRender = () => this.renderUpdate();
    }

    /** Create clouds to fill screen width with buffer */
    private createInitialClouds() {
        const screenWidth = app.screen.width;
        const screenHeight = app.screen.height;

        // Set cloudWidth to screen width
        this.cloudWidth = screenWidth;

        // Calculate how many clouds we need (2 clouds minimum for seamless loop)
        const numClouds = 3;

        for (let i = 0; i < numClouds; i++) {
            // Alternate between cloud_1 and cloud_2
            const cloudType = i % 2 === 0 ? 'cloud_1' : 'cloud_2';
            const cloud = Sprite.from(cloudType);

            // Set cloud size to match screen with 1px overlap to prevent gaps
            cloud.width = screenWidth + 2;
            cloud.height = screenHeight;

            // Position clouds side by side (overlap by 1px)
            cloud.x = i * this.cloudWidth - 1;
            cloud.y = 0;

            this.clouds.push(cloud);
            this.addChild(cloud);
        }
    }

    /** Auto-update every frame */
    public renderUpdate() {
        const delta = app.ticker.deltaTime;
        const moveAmount = this.speed * delta;

        // Move all clouds to the left
        for (let i = 0; i < this.clouds.length; i++) {
            const cloud = this.clouds[i];
            cloud.x -= moveAmount;

            // When a cloud moves completely off the left side, move it to the right
            if (cloud.x <= -this.cloudWidth) {
                // Find the rightmost cloud position
                let rightmostX = -Infinity;
                for (let j = 0; j < this.clouds.length; j++) {
                    if (this.clouds[j].x > rightmostX) {
                        rightmostX = this.clouds[j].x;
                    }
                }

                // Position this cloud right after the rightmost cloud (with 1px overlap)
                cloud.x = rightmostX + this.cloudWidth;
            }
        }
    }

    /** Resize the background, fired whenever window size changes */
    public resize(width: number, height: number) {
        // Update cloudWidth to new screen width
        this.cloudWidth = width;

        // Update cloud dimensions to match screen with overlap
        this.clouds.forEach((cloud, index) => {
            cloud.width = width + 2;
            cloud.height = height;
            cloud.x = index * this.cloudWidth - 1;
            cloud.y = 0;
        });

        // Recalculate number of clouds needed
        const numCloudsNeeded = 3;

        // Add more clouds if needed
        while (this.clouds.length < numCloudsNeeded) {
            const cloudType = this.clouds.length % 2 === 0 ? 'cloud_1' : 'cloud_2';
            const cloud = Sprite.from(cloudType);

            // Set cloud size to match screen with overlap
            cloud.width = width + 2;
            cloud.height = height;

            let rightmostX = -Infinity;
            this.clouds.forEach((c) => {
                if (c.x > rightmostX) rightmostX = c.x;
            });

            cloud.x = rightmostX + this.cloudWidth;
            cloud.y = 0;

            this.clouds.push(cloud);
            this.addChild(cloud);
        }

        // Remove excess clouds if screen got smaller
        while (this.clouds.length > numCloudsNeeded) {
            const cloud = this.clouds.pop();
            if (cloud) {
                this.removeChild(cloud);
            }
        }
    }
}
