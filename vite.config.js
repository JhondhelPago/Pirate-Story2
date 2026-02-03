export default {
    base: './',
    server: {
        host: true,
        port: 8000,
        proxy: {
            "/api": {
                target: "https://slotapi.online",
                changeOrigin: true,
                secure: false,
            },
        },
    },
    define: {
        APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
};
