-- Update handle_new_user to store country, state_code, region from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_country text;
  v_state   text;
  v_region  text;
BEGIN
  v_country := new.raw_user_meta_data->>'country';
  v_state   := new.raw_user_meta_data->>'state_code';

  -- Compute region tag from country code
  v_region := CASE
    WHEN v_country = 'US' THEN 'US'
    WHEN v_country = 'CA' THEN 'CAN'
    WHEN v_country = 'GB' THEN 'UK'
    WHEN v_country = 'AU' THEN 'AU'
    WHEN v_country IN ('BR','MX','CO','AR','CL','PE','EC','VE','UY','PY','BO','CR','PA','GT','HN','SV','NI','DO','PR','JM','CU','TT') THEN 'LATAM'
    WHEN v_country IN ('DE','FR','IT','ES','NL','BE','AT','SE','NO','DK','FI','PL','PT','IE','CZ','RO','HU','GR','CH','BG','HR','SK','SI','LT','LV','EE','LU','MT','CY') THEN 'EU'
    ELSE NULL
  END;

  INSERT INTO public.profiles (id, username, username_lower, verified, country, state_code, region)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'p' || substr(new.id::text,1,7)),
    lower(coalesce(new.raw_user_meta_data->>'username', 'p' || substr(new.id::text,1,7))),
    new.email_confirmed_at IS NOT NULL,
    v_country,
    v_state,
    v_region
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END $function$;
