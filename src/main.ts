import '@esotericsoftware/spine-pixi-v8';

import { Application } from 'pixi.js';
import { initAssets } from './utils/assets';
import { navigation } from './utils/navigation';
import { LoadScreen } from './screens/LoadScreen';
import { sound } from '@pixi/sound';
import { IslandBackground } from './ui/IslandBackground';
import { getUrlParam, updateUrlSettings } from './utils/getUrlParams';
import { GameScreen } from './screens/GameScreen';
import { FreeSpinWinPopup } from './popups/FreeSpinWinPopup';
import { userSettings } from './utils/userSettings';
import Config, { isAuthenticated } from './slot/SlotSettings';
import { i18n } from './i18n/i18n';
import { showErrorScreen } from './utils/error';
import { GameServices } from './api/services';

/** The PixiJS app Application instance */
export const app = new Application();

/** Resize logic */
function resize() {
    const isMobile = document.documentElement.id === 'isMobile';
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let baseWidth, baseHeight;
    if (isMobile) {
        const isLandscape = windowWidth > windowHeight;
        if (isLandscape) {
            baseWidth = 1920;
            baseHeight = 1080;
        } else {
            baseWidth = 1080;
            baseHeight = 1920;
        }
    } else {
        baseWidth = 1920;
        baseHeight = 1080;
    }

    const scaleX = windowWidth / baseWidth;
    const scaleY = windowHeight / baseHeight;
    const scale = Math.min(scaleX, scaleY);

    const scaledWidth = baseWidth * scale;
    const scaledHeight = baseHeight * scale;
    const centerX = (windowWidth - scaledWidth) / 2;
    const centerY = (windowHeight - scaledHeight) / 2;

    app.renderer.canvas.style.width = `${scaledWidth}px`;
    app.renderer.canvas.style.height = `${scaledHeight}px`;
    app.renderer.canvas.style.position = 'absolute';
    app.renderer.canvas.style.left = `${centerX}px`;
    app.renderer.canvas.style.top = `${centerY}px`;

    app.renderer.resize(baseWidth, baseHeight);

    navigation.resize(baseWidth, baseHeight);
    window.scrollTo(0, 0);
}

/** Pause/resume on tab visibility */
function visibilityChange() {
    if (document.hidden) {
        sound.pauseAll();
        navigation.blur();
    } else {
        sound.resumeAll();
        navigation.focus();
    }
}

/** User settings setup */
async function setupUserSettings() {
    await userSettings.setupGameConfig();
    await userSettings.setupCollect();

    const config = Config.getConfig();    // uncomment in production
    updateUrlSettings(config.language, config.currency);
    i18n.init();
    await userSettings.setupResume();
}

/** Preload fonts */
async function preloadFonts() {
    if (!('fonts' in document)) return;
    const docFonts = (document as any).fonts;
    await Promise.all([docFonts.load('18px "Nunito"'), docFonts.load('18px "Bangers"')]);
    await docFonts.ready;
    console.log('Fonts fully loaded (Nunito + Bangers)');
}

/** Main bootstrap */
async function init() {
    if (!isAuthenticated) showErrorScreen('No token provided.');
    const gameConfiguration = await GameServices.getGameConfig();
    Config.setConfig(gameConfiguration.data);
    console.log("configration data from api services: ", Config.getConfig());


    // Setup app and assets
    await setupUserSettings();
    await preloadFonts();

    // @ts-expect-error: expose PIXI app for debugging in devtools
    globalThis.__PIXI_APP__ = app;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    document.documentElement.id = isMobile ? 'isMobile' : 'isDesktop';

    await app.init({
        resolution: isMobile ? Math.min(window.devicePixelRatio, 0.75) : Math.max(window.devicePixelRatio, 2),
        backgroundColor: 0x000000,
    });

    document.body.appendChild(app.canvas);

    window.addEventListener('resize', resize);
    resize();
    document.addEventListener('visibilitychange', visibilityChange);

    await initAssets();
    navigation.setBackground(IslandBackground);
    await navigation.showScreen(LoadScreen);

    const gameParam = getUrlParam('game');
    const loadParam = getUrlParam('load');
    const modalParam = getUrlParam('modal');

    if (gameParam !== null) await navigation.showScreen(GameScreen);
    else if (loadParam !== null) await navigation.showScreen(LoadScreen);
    else if (modalParam !== null) {
        navigation.presentPopup(FreeSpinWinPopup, {
            winAmount: 100000,
            spinsCount: 3,
            callBack: async () => console.log('HELLO'),
        });
    } else await navigation.showScreen(LoadScreen);
}

// Start everything
init();
