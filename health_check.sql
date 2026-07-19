-- Health check: verify all RPC functions compile and critical ones execute without error

-- 1. List all public functions
SELECT routine_name, data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
