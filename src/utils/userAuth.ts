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
}

/** SHared user settings instance */
export const userAuth = new UserAuth();
