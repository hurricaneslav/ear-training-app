import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: замени 'ear-training-app' на реальное имя твоего GitHub-репозитория
export default defineConfig({
  plugins: [react()],
  base: '/ear-training-app/',
});
