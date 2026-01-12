import axiosInstance from "../config/axios";
import { userAuth } from "../../utils/userAuth";

export const loginCred = {
    token: "7408d33a197ca940e6bb31e5d3f7b313",
};

export const login = async () => { // in future  accept token parameter to be the body of this post request
    const res = await axiosInstance.post('/auth/login', loginCred);

    const accessToken = res.data?.data?.accessToken;

    if (!accessToken) {
        throw new Error('No access token returned from login');
    }

    userAuth.set(accessToken); // automatically store the access token

    return res;
};
