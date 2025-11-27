import { Container, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { sfx } from '../utils/audio';

/** Message pagination dots component */
export class MessagePagination extends Container {
    /** Pagination dots */
    private paginationDots: Sprite[] = [];
    /** Current active index */
    private currentIndex: number = 0;
    /** Number of pages/messages */
    private pageCount: number;
    /** Callback when dot is clicked */
    private onPageChange?: (index: number) => void;

    constructor(pageCount: number, dotSpacing: number = 80) {
        super();

        this.pageCount = pageCount;
        this.createPaginationDots(dotSpacing);
    }

    /** Create pagination dots */
    private createPaginationDots(dotSpacing: number) {
        const totalWidth = (this.pageCount - 1) * dotSpacing;
        const startX = -totalWidth / 2;

        for (let i = 0; i < this.pageCount; i++) {
            const dot = Sprite.from(i === 0 ? 'dot-active' : 'dot');
            dot.anchor.set(0.5);
            dot.x = startX + i * dotSpacing;
            dot.y = 0;
            dot.eventMode = 'static';
            dot.cursor = 'pointer';

            // Make dots clickable
            dot.on('pointerdown', () => {
                this.setActivePage(i);
                if (this.onPageChange) {
                    sfx.play('common/sfx-press.wav');
                    this.onPageChange(i);
                }
            });

            // Add hover effect
            dot.on('pointerover', () => {
                sfx.play('common/sfx-hover.wav');
                gsap.to(dot.scale, {
                    x: 1.2,
                    y: 1.2,
                    duration: 0.2,
                    ease: 'power2.out',
                });
            });

            dot.on('pointerout', () => {
                gsap.to(dot.scale, {
                    x: 1,
                    y: 1,
                    duration: 0.2,
                    ease: 'power2.out',
                });
            });

            this.addChild(dot);
            this.paginationDots.push(dot);
        }
    }

    /** Set active page/dot */
    public setActivePage(index: number) {
        if (index === this.currentIndex || index < 0 || index >= this.pageCount) {
            return;
        }

        this.currentIndex = index;
        this.updateDots();
    }

    /** Update dot visuals to show current active page */
    private updateDots() {
        this.paginationDots.forEach((dot, index) => {
            if (index === this.currentIndex) {
                // Active dot
                dot.texture = Sprite.from('dot-active').texture;
                gsap.to(dot.scale, {
                    x: 1.2,
                    y: 1.2,
                    duration: 0.3,
                    ease: 'back.out(1.7)',
                });
            } else {
                // Inactive dot
                dot.texture = Sprite.from('dot').texture;
                gsap.to(dot.scale, {
                    x: 1,
                    y: 1,
                    duration: 0.3,
                    ease: 'power2.out',
                });
            }
        });
    }

    /** Set callback for when page changes */
    public setOnPageChange(callback: (index: number) => void) {
        this.onPageChange = callback;
    }

    /** Get current active index */
    public getCurrentIndex(): number {
        return this.currentIndex;
    }

    /** Go to next page */
    public nextPage() {
        const nextIndex = (this.currentIndex + 1) % this.pageCount;
        this.setActivePage(nextIndex);
        if (this.onPageChange) {
            this.onPageChange(nextIndex);
        }
    }

    /** Go to previous page */
    public previousPage() {
        const prevIndex = (this.currentIndex - 1 + this.pageCount) % this.pageCount;
        this.setActivePage(prevIndex);
        if (this.onPageChange) {
            this.onPageChange(prevIndex);
        }
    }
}
