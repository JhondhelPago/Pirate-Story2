import { GameServices } from '../api/services';
import { tryRefreshToken } from '../api/services/authServices';
import { getUrlParam } from '../utils/getUrlParams';
import { userAuth } from '../utils/userAuth';

async function authenticateLogin() {
    const urlToken = getUrlParam('token');
    try {
        if (urlToken) {
            await userAuth.login(urlToken);
            // userAuth.setGameCode(gameCode);
            const url = new URL(window.location.href);
            // url.searchParams.delete('token');
            window.history.replaceState({}, '', url.toString());
            return true;
        }

        return await tryRefreshToken();
    } catch (err) {
        return false;
    }
}

// initial post request to the api to get the game configuration and authentication for the slot user
export const isAuthenticated = await authenticateLogin();


class Config {
    private static config = {} as any;
    static getConfig() {
        return this.config;
    }

    static setConfig(newConfig: any) {
        this.config = newConfig;
    }
}

export default Config

//PIRATE STORY GAME CONFIG
const response = await GameServices.getGameConfig();
export const config = response.data;
