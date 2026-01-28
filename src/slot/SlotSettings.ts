import { GameServices } from "../api/services";
import { getUrlParam } from "../utils/getUrlParams";
import { userAuth } from "../utils/userAuth";

async function authenticateLogin(){
    const urlToken = getUrlParam('token');
    try {
        if (urlToken) {
            await userAuth.login(urlToken);
            // userAuth.setGameCode(gameCode);
            const url = new URL(window.location.href);
            // url.searchParams.delete('token');
            window.history.replaceState({}, '', url.toString());
        } else if (!userAuth.has()) {
            return false;
        }
        return true;
    } catch (err) {
        return false;
    }
}


// initial post request to the api to get the game configuration and authentication for the slot user
export const isAuthenticated = await authenticateLogin();

//PIRATE STORY GAME CONFIG
const response = await GameServices.getGameConfig();
export const config = response.data;