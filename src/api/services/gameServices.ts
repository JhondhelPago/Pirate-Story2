import axios from 'axios';
import axiosInstance from '../config/axios';
import { userSettings } from '../../utils/userSettings';

const gameCode = 'piratestory';

interface CollectData {
    index: number;
    balance: number;
}

export const getGameConfig = async () => {
    const response = await axiosInstance.get('/game/settings', {
        params: {
            gamecode: gameCode,
        },
    });

    return response.data;
};

export const collect = async (): Promise<CollectData> => {
    return axiosInstance
        .get('/game/collect', {
            params: {
                gamecode: gameCode,
            },
        })
        .then((res) => res.data.data as CollectData)
        .catch((error) => {
            console.error('[collect] failed:', error);
            return { index: -1, balance: 0 };
        });
};

export const checkResume = async () => {
    return axiosInstance
        .get('/game/check-resume', {
            params: {
                gamecode: gameCode,
            },
        })
        .then((res) => res.data.data as any)
        .catch((error) => {
            console.error('[checkResume] failed:', error);
            return null;
        });
};

export const spin = async (feature: number) => {
    try {
        const response = await axiosInstance.post('/game/spin', {
            gamecode: gameCode,
            bet: userSettings.getBet(),
            feature: feature,
            index: userSettings.incrementSpinIndex(), // incremented by 1 to request the next genereted reels result
        });

        console.log('spin index used: ', userSettings.getSpinIndex());

        console.log('spin response: ', response.data);

        return response.data;
    } catch (error: any) {
        // roll back the spin index here
        userSettings.decrementSpinIndex();

        if (axios.isAxiosError(error)) {
            const data = error.response?.data;
            console.error('[spin] failed:', data);
        }

        throw error;
    }
};
