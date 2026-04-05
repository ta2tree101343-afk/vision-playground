var config = {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                ink: '#0f172a',
                brand: '#0f766e',
                accent: '#14b8a6',
                paper: '#f8fafc',
            },
            boxShadow: {
                panel: '0 18px 45px -24px rgba(15, 23, 42, 0.35)',
            },
        },
    },
    plugins: [],
};
export default config;
