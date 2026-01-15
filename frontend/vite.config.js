import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        host: true, // Listen on all addresses
        port: 5173,
        watch: {
            usePolling: true // Fix some HMR issues on Windows
        }
    },
    define: {
        'process.env': process.env // Polyfill for some libs using process.env
    }
});
