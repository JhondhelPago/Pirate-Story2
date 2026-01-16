import { AuthServices } from "../api/services";

class UserAuth {
    public accessToken: string | null = null;

    public set(token: string) {
        this.accessToken = token;
    }

    public get(): string | null {
        return this.accessToken;
    }

    public clear() {
        this.accessToken = null;
    }


    public async login(token: string) {
        const response = await AuthServices.login(token);
        this.accessToken = response.data.data.accessToken;
        return response;
    }
}

/** SHared user settings instance */
export const userAuth = new UserAuth();
