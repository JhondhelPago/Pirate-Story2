import axios, { AxiosInstance } from 'axios';
import { userAuth } from '../../utils/userAuth';

// Axios instance with base URL and default headers
const axiosInstance: AxiosInstance = axios.create({
    baseURL:
        /** @ts-ignore */
        import.meta.env.MODE === 'development'
            ? /** @ts-ignore */
              `${import.meta.env.VITE_DEV_API_URL}/api`
            : /** @ts-ignore */
              `${import.meta.env.VITE_PROD_API_URL}/api`,
    timeout: 30000, // 30 seconds
    withCredentials: true,
});

// Axios interceptor to attach token to outgoing requests
axiosInstance.interceptors.request.use(
    (config) => {
        const token = userAuth.get();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    },
);

/**
 * 
 * If I get this response it means I need to refresh my token by calling this /api/auth/refresh-token {
    "Code": 401,
    "Message": "Invalid or expired access token.",
    "Error": null
  }

  and if success then I can use the previous  Invalid or expired access token
 * 
 */

let isRefreshing = false;
let failedQueue: { resolve: Function; reject: Function }[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

// Handle token refresh on 401 error
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: any) => {
        const originalRequest: any = error.config;

        if (
            error.response?.status === 401 &&
            error.response?.data?.Message === 'Invalid or expired access token.' &&
            !originalRequest._retry
        ) {
            originalRequest._retry = true;

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({
                        resolve: (token: string) => {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                            resolve(axiosInstance(originalRequest));
                        },
                        reject: (err: any) => reject(err),
                    });
                });
            }

            isRefreshing = true;

            try {
                const res = await axios.post('/auth/refresh', null, {
                    baseURL: axiosInstance.defaults.baseURL,
                    withCredentials: true, // if using cookies
                    headers: {},
                });

                const newAccessToken = res.data?.data?.accessToken;

                if (newAccessToken) {
                    userAuth.set(newAccessToken);
                    processQueue(null, newAccessToken);
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    return axiosInstance(originalRequest);
                } else {
                    throw new Error('No new access token returned');
                }
            } catch (err) {
                processQueue(err, null);
                return Promise.reject(err);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    },
);

export default axiosInstance;
