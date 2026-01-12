import axiosInstance from "../config/axios";

export const loginCred = {
    token: "7408d33a197ca940e6bb31e5d3f7b313"
}

export const login = async () => {
    console.log("FINAL URL:", axiosInstance.defaults.baseURL + "/auth/login");

    return axiosInstance.post('/auth/login',loginCred);
}