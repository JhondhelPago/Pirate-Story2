import { AuthServices } from "../api/services";

const STORAGE_KEY = "accessToken";

class UserAuth {
    public accessToken: string | null = null;

    constructor() {
        // 🔹 Restore token from localStorage if exists
        const savedToken = localStorage.getItem(STORAGE_KEY);
        if (savedToken) {
            this.accessToken = savedToken;
        }
    }

    public set(token: string) {
        this.accessToken = token;
        localStorage.setItem(STORAGE_KEY, token);
    }

    public get(): string | null {
        return this.accessToken;
    }

    public has(): boolean {
        return !!this.accessToken;  
    }

    public clear() {
        this.accessToken = null;
        localStorage.removeItem(STORAGE_KEY);
    }

    // 🔹 Always try to login with provided token
    public async login(token: string) {
        try {
            const res = await AuthServices.login(token);

            const accessToken = res.data?.data?.accessToken;

            if (!accessToken) {
                throw new Error("No access token returned from login");
            }

            this.set(accessToken); // store in memory + localStorage
            return res;
        } catch (err) {
            // wipe old token if login fails
            this.clear();

            throw err; // let caller handle error (showErrorScreen)
        }
    }
}

/** Shared instance */
export const userAuth = new UserAuth();
