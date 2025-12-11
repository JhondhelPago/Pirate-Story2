import { Container, Sprite, Texture } from 'pixi.js';
import { Label } from '../ui/Label';
import { IconButton } from '../ui/IconButton2';
import { navigation } from '../utils/navigation';
import { PayTableSection } from '../ui/PaytableSection';
import { FeatureSection } from '../ui/FeatureSection';
import { HowToPlaySection } from '../ui/HowToPlaySection';
import { SettingsMenuSection } from '../ui/SettingsMenuSection';
import { pool } from '../utils/pool';
import { FreeSpinSection } from '../ui/FreeSpinSection';
import { ScatterSection } from '../ui/ScatterSection';

interface ModalSection extends Container {
    /** Show the screen */
    show?(): Promise<void>;
    /** Hide the screen */
    hide?(): Promise<void>;
    /** Pause the screen */
    pause?(): Promise<void>;
    /** Resume the screen */
    resume?(): Promise<void>;
    /** Prepare screen, before showing */
    prepare?(): void;
    /** Reset screen, after hidden */
    reset?(): void;
    /** Update the screen, passing delta time/step */
    update?(delta: number): void;
    /** Check the progress */
    progress?(progress: number): void;
    /** Resize the screen */
    resize?(width: number, height: number): void;
    /** Blur the screen */
    blur?(): void;
    /** Focus the screen */
    focus?(): void;
}
/** Interface for app screens constructors */
interface SectionConstructor {
    new (): ModalSection;
}

export type InfoPopupData = {
    finished: boolean;
    onBetChanged: () => void;
};

/** Popup for volume and game mode settings */
export class InfoPopup extends Container {
    private bg: Sprite;
    /** Modal title */
    private title: Label;
    /** Close buttom */
    private closeButton: IconButton;
    /** The panel background sprite */
    private panelBg: Sprite;
    /** Base container for all panel content */
    private panelBase: Container;
    /** Height of the panel */
    private panelHeight: number = 0;
    /** Width of the panel */
    private panelWidth: number = 0;
    /** Container for the popup UI components */
    private container: Container;
    /** Section current index */
    private sectionIndex: number = 0;
    /** Page label */
    private sectionlabel: Label;
    /** Current in viewed section */
    public currentSection?: ModalSection;
    /** Left button */
    public leftButton: IconButton;
    /** Right button */
    public rightButton: IconButton;
    /** Sections */
    private sections: { title: string; section: SectionConstructor }[] = [
        {
            title: 'Paytable',
            section: PayTableSection,
        },
        {
            title: 'Scatter',
            section: ScatterSection,
        },
        {
            title: 'CASCADE FEATURE',
            section: FeatureSection,
        },
        {
            title: 'FREE SPINS',
            section: FreeSpinSection,
        },
        {
            title: 'How to play',
            section: HowToPlaySection,
        },
        {
            title: 'Settings menu',
            section: SettingsMenuSection,
        },
    ];

    constructor() {
        super();

        this.bg = Sprite.from(Texture.WHITE);
        this.bg.interactive = true;
        this.bg.alpha = 0.7;
        this.bg.tint = 0x000000;
        this.addChild(this.bg);

        this.panelWidth = 1400;
        this.panelHeight = 800;

        // Create panel base container
        this.panelBase = new Container();
        this.addChild(this.panelBase);

        // Create panel background sprite
        this.panelBg = Sprite.from(Texture.WHITE);
        this.panelBg.tint = 0x3b3b3b;
        this.panelBg.width = this.panelWidth;
        this.panelBg.height = this.panelHeight;
        this.panelBase.addChild(this.panelBg);

        this.title = new Label('Information', {
            fill: '#FCC100',
        });
        this.title.anchor.set(0.5);
        this.title.style.fontSize = 32;
        this.panelBase.addChild(this.title);

        this.closeButton = new IconButton({
            imageDefault: 'icon-button-default-close-view',
            imageHover: 'icon-button-active-close-view',
            imagePressed: 'icon-button-active-close-view',
            imageDisabled: 'icon-button-active-close-view',
        });
        this.closeButton.scale.set(0.5);
        this.closeButton.onPress.connect(() => navigation.dismissPopup());
        this.panelBase.addChild(this.closeButton);

        this.sectionlabel = new Label('', { fill: '#ffffff', fontSize: 20 });
        this.sectionlabel.anchor.set(0.5);
        this.panelBase.addChild(this.sectionlabel);

        this.container = new Container();
        this.panelBase.addChild(this.container);

        this.leftButton = new IconButton({
            imageDefault: 'icon-button-left-arrow-default-view',
            imageHover: 'icon-button-left-arrow-active-view',
            imagePressed: 'icon-button-left-arrow-active-view',
            imageDisabled: 'icon-button-left-arrow-active-view',
        });
        this.leftButton.anchor.set(0.5);
        this.leftButton.scale.set(0.75);
        this.panelBase.addChild(this.leftButton);
        this.leftButton.onPress.connect(() => this.back());

        this.rightButton = new IconButton({
            imageDefault: 'icon-button-right-arrow-default-view',
            imageHover: 'icon-button-right-arrow-active-view',
            imagePressed: 'icon-button-right-arrow-active-view',
            imageDisabled: 'icon-button-right-arrow-active-view',
        });
        this.rightButton.anchor.set(0.5);
        this.rightButton.scale.set(0.75);
        this.panelBase.addChild(this.rightButton);
        this.rightButton.onPress.connect(() => this.next());

        // Center panel base
        this.panelBase.pivot.set(this.panelWidth / 2, this.panelHeight / 2);

        this.init();
    }

    /** Resize the popup, fired whenever window size changes */
    public resize(width: number, height: number) {
        this.bg.width = width;
        this.bg.height = height;

        const isMobile = document.documentElement.id === 'isMobile';
        const isPortrait = width < height;

        let titleFontSize: number;
        let sectionFontSize: number;
        let closeScale: number;
        let navScale: number;

        if (isMobile) {
            this.panelWidth = width * (isPortrait ? 0.95 : 0.9);
            this.panelHeight = height * (isPortrait ? 0.9 : 0.95);
            titleFontSize = 52;
            sectionFontSize = 28;
            closeScale = 0.75;
            navScale = 1;
        } else {
            this.panelWidth = 1400;
            this.panelHeight = 800;
            titleFontSize = 32;
            sectionFontSize = 20;
            closeScale = 0.5;
            navScale = 0.75;
        }

        /** Panel background sprite */
        this.panelBg.width = this.panelWidth;
        this.panelBg.height = this.panelHeight;

        /** Center panel base */
        this.panelBase.pivot.set(this.panelWidth / 2, this.panelHeight / 2);
        this.panelBase.x = width * 0.5;
        this.panelBase.y = height * 0.5;

        /** Title */
        this.title.style.fontSize = titleFontSize;
        this.title.x = this.panelWidth * 0.5;
        this.title.y = 100;

        /** Close button */
        this.closeButton.scale.set(closeScale);
        this.closeButton.x = this.panelWidth - 60;
        this.closeButton.y = 60;

        /** Right button */
        this.rightButton.scale.set(navScale);
        this.rightButton.x = this.panelWidth - this.rightButton.width * 0.5 - 40;
        this.rightButton.y = this.panelHeight * 0.5;

        /** Left button */
        this.leftButton.scale.set(navScale);
        this.leftButton.x = this.leftButton.width * 0.5 + 40;
        this.leftButton.y = this.panelHeight * 0.5;

        /** Section label */
        this.sectionlabel.style.fontSize = sectionFontSize;
        this.sectionlabel.x = this.panelWidth * 0.5;
        this.sectionlabel.y = this.panelHeight - this.sectionlabel.height - 30;

        if (this.currentSection && this.currentSection.resize) {
            this.currentSection.resize(this.panelWidth - 200, this.panelHeight - 200);
            this.currentSection.x = 100;
            this.currentSection.y = 100;
        }
    }

    /** Set things up just before showing the popup */
    public prepare(_data: InfoPopup) {}

    public update() {}

    public updateSectionInfo() {
        const title = this.sections[this.sectionIndex].title;
        const sectionLabel = `${'Section'} ${this.sectionIndex + 1}/${this.sections.length}`;

        this.title.text = title;
        this.sectionlabel.text = sectionLabel;
    }

    public async init() {
        await this.showSection(this.sections[this.sectionIndex].section);
        this.updateSectionInfo();
    }

    public async next() {
        if (this.sectionIndex < this.sections.length - 1) {
            this.sectionIndex++;
        } else {
            this.sectionIndex = 0;
        }
        await this.showSection(this.sections[this.sectionIndex].section);
        this.updateSectionInfo();
    }

    public async back() {
        if (this.sectionIndex > 0) {
            this.sectionIndex--;
        } else {
            this.sectionIndex = this.sections.length - 1;
        }
        await this.showSection(this.sections[this.sectionIndex].section);
        this.updateSectionInfo();
    }

    /** Show section */
    public async showSection(ctor: SectionConstructor) {
        if (this.currentSection) {
            this.currentSection.interactiveChildren = false;
        }

        if (this.currentSection) {
            await this.hideAndRemoveSection(this.currentSection);
        }

        this.currentSection = pool.get(ctor);
        await this.addAndShowSection(this.currentSection);
    }

    /** Remove screen from the stage, unlink update & resize functions */
    private async hideAndRemoveSection(section: ModalSection) {
        section.interactiveChildren = false;

        if (section.hide) {
            await section.hide();
        }

        if (section.parent) {
            section.parent.removeChild(section);
        }

        if (section.reset) {
            section.reset();
        }
    }

    /** Add screen to the stage, link update & resize functions */
    private async addAndShowSection(section: ModalSection) {
        if (!this.container.parent) {
            this.panelBase.addChild(this.container);
        }

        this.container.addChild(section);

        if (section.prepare) {
            section.prepare();
        }

        if (section.resize) {
            section.resize(this.panelWidth - 200, this.panelHeight - 200);
            section.x = 100;
            section.y = 100;
        }

        if (section.show) {
            section.interactiveChildren = false;
            await section.show();
            section.interactiveChildren = true;
        }
    }
}
