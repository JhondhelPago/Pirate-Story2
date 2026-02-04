import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
    const isProd = mode === 'production';

    return {
        base: './',
        server: {
            host: true,
            port: 8000,
            proxy: {
                '/api': {
                    target: 'https://slotapi.online',
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
        define: {
            APP_VERSION: JSON.stringify(process.env.npm_package_version),
        },
        build: {
            minify: 'terser',
            terserOptions: {
                compress: {
                    drop_console: isProd,   // 🔥 removes console.log in prod
                    drop_debugger: isProd,
                },
            },
        },
    };
});
