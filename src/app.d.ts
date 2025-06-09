// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

// Environment variables
declare module '$env/static/public' {
	export const PUBLIC_SUPABASE_URL: string;
	export const PUBLIC_SUPABASE_ANON_KEY: string;
}

declare module '$env/static/private' {
	export const SUPABASE_SERVICE_ROLE_KEY: string;
	export const OPENAI_API_KEY: string;
	export const R2_ACCESS_KEY: string;
	export const R2_SECRET_KEY: string;
	export const JWT_SECRET: string;
}

export {};
