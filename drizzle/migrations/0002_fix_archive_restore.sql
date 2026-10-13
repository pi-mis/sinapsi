CREATE OR REPLACE FUNCTION public.restore_archive(payload jsonb) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE tbl text; cols text; updates text; keys text; conflict text; restored integer := 0;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Accesso richiesto'; END IF;
 IF payload->>'version' <> '1' THEN RAISE EXCEPTION 'Archivio non compatibile'; END IF;
 FOREACH tbl IN ARRAY ARRAY['sources','contacts','clusters','notes','tags','entities','edges','note_tags','note_entities','graph_settings'] LOOP
  IF jsonb_typeof(payload->'tables'->tbl) <> 'array' THEN RAISE EXCEPTION 'Archivio incompleto'; END IF;
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl AND is_generated='NEVER';
  SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord) INTO keys FROM pg_index i CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum,ord) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum WHERE i.indrelid=('public.'||tbl)::regclass AND i.indisprimary;
  SELECT string_agg(format('%I = EXCLUDED.%I', column_name,column_name), ', ') INTO updates FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl AND is_generated='NEVER' AND column_name<>'user_id' AND NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey) WHERE i.indrelid=('public.'||tbl)::regclass AND i.indisprimary AND a.attname=column_name);
  conflict := CASE WHEN updates IS NULL THEN 'DO NOTHING' ELSE 'DO UPDATE SET ' || updates END;
  EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT (%s) %s', tbl,cols,cols,tbl,keys,conflict) USING (SELECT coalesce(jsonb_agg(row || jsonb_build_object('user_id', auth.uid())), '[]'::jsonb) FROM jsonb_array_elements(payload->'tables'->tbl) row);
 END LOOP;
 restored := jsonb_array_length(payload->'tables'->'notes');
 RETURN restored;
END $$;
REVOKE ALL ON FUNCTION public.restore_archive(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_archive(jsonb) TO authenticated;