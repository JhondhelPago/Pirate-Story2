import axiosInstance from "../config/axios";

const Code = 'piratestory';

export const getGameConfig = async () => {
    const response = await axiosInstance.get('/game/settings', {
        params: {
            gamecode: Code
        },
    });

    return response.data;
}

export const collect = async () => {
    const response = await axiosInstance.get('/game/collect', {
        params: {
            gamecode: Code
        },
    });

    return response.data;
}

export const spin = async () => {
    // return axiosInstance.get
}

