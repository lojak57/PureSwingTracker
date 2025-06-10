import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Using Vercel adapter for optimal deployment
		adapter: adapter({
			runtime: 'nodejs18.x',
			regions: ['iad1']
		})
	}
};

export default config;
