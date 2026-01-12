export default {
    base: './',
    server: {
        host: true,
        port: 8000,
        proxy: {
            "/api": {
                target: "http://139.180.157.23:8083",
                changeOrigin: true,
                secure: false,
            },
        },
    },
    define: {
        APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
};
