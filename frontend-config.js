/**
 * Frontend Configuration
 * 
 * This file contains environment-specific configuration for the frontend.
 * Update the RAILWAY_BACKEND_URL once you deploy your backend to Railway.
 */

const CONFIG = {
    development: {
        API_BASE: 'http://localhost:3000'
    },
    production: {
        // TODO: Replace this with your actual Railway backend URL after deployment
        // Example: 'https://your-backend-app.up.railway.app'
        API_BASE: 'REPLACE_WITH_RAILWAY_URL'
    }
};

// Automatically detect environment based on hostname
const ENV = window.location.hostname === 'localhost' ? 'development' : 'production';

// Export the API base URL for the current environment
export const API_BASE = CONFIG[ENV].API_BASE;

// Export environment name for debugging
export const CURRENT_ENV = ENV;
