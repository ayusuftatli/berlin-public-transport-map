const CONFIG = {
    development: {
        API_BASE: 'http://localhost:3000'
    },
    production: {
        API_BASE: 'https://zestful-learning-production.up.railway.app'
    }
};

const ENV = window.location.hostname === 'localhost' ? 'development' : 'production';

export const API_BASE = CONFIG[ENV].API_BASE;
