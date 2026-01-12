import axiosInstance from "../config/axios";

export const getGameConfig = async () => {
    return axiosInstance.get('/game/settings', {
        params: {
            gamecode: 'piratestory'
        },
    });
}