/**
 * Database Schema Debug Endpoint
 * Quick diagnostic to see what tables and schemas exist
 */

import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';

const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const GET: RequestHandler = async () => {
  try {
    const results: Record<string, any> = {};

    // 1. Check if 'swings' table exists in public schema
    try {
      const { data, error } = await adminClient
        .from('swings')
        .select('id')
        .limit(1);
      
      results.public_swings = {
        exists: !error,
        error: error?.message
      };
    } catch (error) {
      results.public_swings = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // 2. Check if 'pure.swings' exists
    try {
      const { data, error } = await adminClient
        .from('pure.swings')
        .select('id')
        .limit(1);
      
      results.pure_swings = {
        exists: !error,
        error: error?.message
      };
    } catch (error) {
      results.pure_swings = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // 3. List all tables we can see
    try {
      const { data: tables, error } = await adminClient
        .rpc('get_tables_list');
      
      results.available_tables = {
        success: !error,
        tables: tables || [],
        error: error?.message
      };
    } catch (error) {
      // Fallback: try to query information_schema if available
      results.available_tables = {
        success: false,
        note: 'get_tables_list function not available',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // 4. Check current database user
    try {
      const { data, error } = await adminClient
        .rpc('current_user');
      
      results.database_user = {
        success: !error,
        user: data,
        error: error?.message
      };
    } catch (error) {
      results.database_user = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return json({
      status: 'success',
      results,
      suggestions: {
        if_public_swings_exists: "Tables are in public schema - update health check",
        if_neither_exists: "Need to create swings table first",
        if_pure_swings_exists: "Schema is correct - migration issue"
      }
    });

  } catch (error) {
    return json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}; 