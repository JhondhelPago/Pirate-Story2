import { AuthServices } from '../api/services';

class UserAuth {
    private accessToken: string | null = null;

    public set(token: string) {
        this.accessToken = token;
    }

    public get(): string | null {
        return this.accessToken;
    }

    public has(): boolean {
        return !!this.accessToken;
    }

    public clear() {
        this.accessToken = null;
    }

    // Always try to login with provided token
    public async login(token: string) {
        try {
            const res = await AuthServices.login(token);

            const accessToken = res.data?.data?.accessToken;

            if (!accessToken) {
                throw new Error('No access token returned from login');
            }

            this.set(accessToken); // store ONLY in memory
            return res;
        } catch (err) {
            this.clear();
            throw err; // caller handles showErrorScreen
        }
    }
}

/** Shared instance */
export const userAuth = new UserAuth();
