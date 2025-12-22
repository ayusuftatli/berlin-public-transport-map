# Deployment Guide

## Overview

This project has two parts:
- **Backend**: Node.js/Express server (deploy to Railway)
- **Frontend**: Static HTML/JS files (deploy to GitHub Pages, Vercel, Netlify, etc.)

## Backend Deployment (Railway)

### 1. Deploy Backend to Railway

1. Push your backend code to a Git repository
2. Connect the repository to Railway
3. Railway will auto-detect the Node.js app and deploy it
4. After deployment, Railway will provide a URL like:
   ```
   https://your-backend-app.up.railway.app
   ```

### 2. Configure Environment Variables in Railway

In the Railway dashboard, add these environment variables:

```bash
PORT=3000
ALLOWED_ORIGINS=https://your-frontend-url.com,https://www.your-frontend-url.com
```

**Important**: Add your frontend deployment URL to `ALLOWED_ORIGINS` to enable CORS.

## Frontend Deployment

### 1. Update Railway Backend URL

**Before deploying the frontend**, update the Railway URL in [`frontend-config.js`](frontend-config.js):

```javascript
const CONFIG = {
    development: {
        API_BASE: 'http://localhost:3000'
    },
    production: {
        // Replace this with your actual Railway URL
        API_BASE: 'https://your-backend-app.up.railway.app'
    }
};
```

### 2. Deploy Frontend

Deploy the root directory (containing `index.html`, `map.js`, etc.) to:
- **GitHub Pages**
- **Vercel**
- **Netlify**
- Or any static hosting service

## Testing

### Local Testing
1. Start backend: `cd backend && npm start`
2. Open `index.html` in browser (use Live Server extension)
3. Should connect to `http://localhost:3000`

### Production Testing
1. Deploy backend to Railway → Get URL
2. Update `frontend-config.js` with Railway URL
3. Deploy frontend
4. Visit your frontend URL
5. Check browser console for successful API connections

## Troubleshooting

### CORS Errors
- Ensure your frontend URL is added to `ALLOWED_ORIGINS` in Railway environment variables
- Check Railway logs for CORS blocked messages

### API Not Connecting
- Verify Railway backend URL in `frontend-config.js` is correct
- Check Railway deployment logs for errors
- Ensure Railway backend is running (check Railway dashboard)

### Environment Detection
The app automatically detects environment:
- `localhost` → Uses `http://localhost:3000`
- Any other domain → Uses Railway URL
