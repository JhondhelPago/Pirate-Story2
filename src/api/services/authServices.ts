import axiosInstance from '../config/axios';
import { userAuth } from '../../utils/userAuth';
import { showErrorScreen } from '../../utils/error';
import axios from 'axios';

export const login = async (token: string) => {
    try {
        const res = await axiosInstance.post('/auth/login', { token });

        const accessToken = res.data?.data?.accessToken;

        if (!accessToken) {
            throw new Error('No access token returned from login');
        }

        userAuth.set(accessToken);
        return res;
    } catch (err) {
        let message = 'Something went wrong while logging in.';

        if (axios.isAxiosError(err)) {
            if (err.response) {
                // Server responded (400, 401, 500, etc.)
                message =
                    err.response.data?.message ||
                    `Login failed (${err.response.status})`;
            } else if (err.request) {
                message = 'Unable to reach the server. Please check your connection.';
            }
        } else if (err instanceof Error) {
            message = err.message;
        }

        showErrorScreen(message);

        throw err;
    }
};
