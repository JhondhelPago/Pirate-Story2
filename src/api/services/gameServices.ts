import axiosInstance from "../config/axios";

export const getGameConfig = async () => {
    const response = await axiosInstance.get('/game/settings', {
        params: {
            gamecode: 'piratestory'
        },
    });

    return response.data;
}

export const spin = async () => {
    // return axiosInstance.get
}