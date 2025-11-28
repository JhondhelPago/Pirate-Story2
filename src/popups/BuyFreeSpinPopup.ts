import { Container, Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';
import { resolveAndKillTweens } from '../utils/animation';
import { navigation } from '../utils/navigation';

export class BuyFreeSpinPopup extends Container {
    private bg: Sprite;
    private panel: Container;

    private option10: Sprite;
    private option15: Sprite;
    private option20: Sprite;

    private canClickAnywhere = false;

    private onSelect?: (value: number) => void;

    private screenHeight = 0;

    constructor() {
        super();

        this.eventMode = 'static';  // IMPORTANT — allows popup to receive clicks
        this.interactiveChildren = true;

        // Background overlay
        this.bg = new Sprite(Texture.WHITE);
        this.bg.tint = 0x000000;
        this.bg.alpha = 0.75;
        this.bg.eventMode = 'static';
        this.addChild(this.bg);

        // Panel
        this.panel = new Container();
        this.addChild(this.panel);

        this.option10 = Sprite.from('10-spin-banner');
        this.option15 = Sprite.from('15-spin-banner');
        this.option20 = Sprite.from('20-spin-banner');

        for (const s of [this.option10, this.option15, this.option20]) {
            s.anchor.set(0.5);
            s.eventMode = 'static';
            s.cursor = 'pointer';
            this.panel.addChild(s);
        }

        this.option10.on('pointertap', () => this.handleSelect(10));
        this.option15.on('pointertap', () => this.handleSelect(15));
        this.option20.on('pointertap', () => this.handleSelect(20));

        // Clicking background closes popup
        this.bg.on('pointertap', () => {
            if (!this.canClickAnywhere) return;
            this.hide();
        });
    }

    private handleSelect(value: number) {
        if (!this.canClickAnywhere) return;
        this.onSelect?.(value);
        this.hide();
    }

    public prepare<T>(data?: T) {
        // safely extract onSelect if it exists
        const anyData = data as any;
        if (anyData?.onSelect) {
            this.onSelect = anyData.onSelect;
        }
    }


    public resize(width: number, height: number) {
        this.bg.width = width;
        this.bg.height = height;

        this.panel.x = width * 0.5;
        this.panel.y = height * 0.5;

        const spacing = 380;
        this.option10.x = -spacing;
        this.option15.x = 0;
        this.option20.x = spacing;

        this.screenHeight = height;
    }

    public async show() {
        resolveAndKillTweens(this.panel);
        resolveAndKillTweens(this.bg);

        this.bg.alpha = 0;
        this.panel.alpha = 0;
        this.panel.scale.set(0.5);

        const tl = gsap.timeline();
        tl.to(this.bg, { alpha: 0.75, duration: 0.25 });
        tl.to(this.panel, { alpha: 1, duration: 0.3, ease: 'power2.out' }, 0.05);
        tl.to(this.panel.scale, { x: 1, y: 1, duration: 0.45, ease: 'back.out(1.8)' }, 0.05);

        await tl;

        this.canClickAnywhere = true;
    }

    /** When popup closes — use navigation to dismiss */
    public async hide() {
        this.canClickAnywhere = false;

        const tl = gsap.timeline();
        tl.to(this.panel, { alpha: 0, duration: 0.2 });
        tl.to(this.bg, { alpha: 0, duration: 0.2 }, 0);

        await tl;

        await navigation.dismissPopup();  // IMPORTANT
    }
}
