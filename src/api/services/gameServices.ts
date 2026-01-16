import { userSettings } from '../../utils/userSettings';
import axiosInstance from '../config/axios';

const Code = 'piratestory';

const gamecode = 'piratestory';
const bet = 100;
const index = 11;

interface CollectData {
    index: number;
    balance: number;
}

export const getGameConfig = async () => {
    const response = await axiosInstance.get('/game/settings', {
        params: {
            gamecode: Code,
        },
    });

    return response.data;
};

export const collect = async (): Promise<CollectData> => {
    return axiosInstance
        .get('/game/collect', {
            params: {
                gamecode: Code,
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
                gamecode: Code,
            },
        }).then((res) => res.data.data as any)
        .catch((error) => {
            console.error('[checkResume] failed:', error);
            return null;
        });
}

export const spin = async (feature: number) => {
    const response = await axiosInstance.post('/game/spin', {
        gamecode: gamecode,
        bet: bet,
        feature: feature,
        index: userSettings.incrementSpinIndex(), // incremented by 1 to request the next genereted reels result
    });

    console.log('spin response: ', response.data);

    return response.data;
};
