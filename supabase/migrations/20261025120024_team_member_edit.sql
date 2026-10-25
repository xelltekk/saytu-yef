-- Keep privileged profile writes outside the Data API's exposed schema.
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated;

CREATE OR REPLACE FUNCTION app_private.update_team_member(
  p_member_id uuid, p_full_name text, p_role text, p_expected_updated_at timestamptz
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  member public.profiles%ROWTYPE;
  owner_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non connecte' USING ERRCODE='42501'; END IF;
  SELECT * INTO actor FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
  owner_id := coalesce(actor.account_owner_id, actor.id);
  IF actor.id IS NULL OR actor.role IS DISTINCT FROM 'admin'
    OR public.current_account_access_status() IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Action reservee a un administrateur actif' USING ERRCODE='42501';
  END IF;
  IF p_member_id=owner_id OR p_member_id=actor.id THEN
    RAISE EXCEPTION 'Le proprietaire et votre propre acces ne sont pas modifiables ici' USING ERRCODE='42501';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('admin','employee','cashier')
    OR p_full_name IS NULL OR length(btrim(p_full_name)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Nom ou role invalide' USING ERRCODE='22023';
  END IF;
  SELECT * INTO member FROM public.profiles WHERE id=p_member_id AND account_owner_id=owner_id FOR UPDATE;
  IF member.id IS NULL THEN RAISE EXCEPTION 'Membre introuvable' USING ERRCODE='42501'; END IF;
  IF p_expected_updated_at IS NULL OR member.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Ce membre a change. Actualisez la liste avant de reessayer.' USING ERRCODE='40001';
  END IF;
  UPDATE public.profiles SET full_name=btrim(p_full_name),role=p_role,updated_at=clock_timestamp()
    WHERE id=member.id RETURNING * INTO member;
  RETURN jsonb_build_object('id',member.id,'email',member.email,'full_name',member.full_name,
    'role',member.role,'account_owner_id',member.account_owner_id,
    'created_at',member.created_at,'updated_at',member.updated_at);
END;
$$;
REVOKE ALL ON FUNCTION app_private.update_team_member(uuid,text,text,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.update_team_member(uuid,text,text,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_team_member(
  p_member_id uuid, p_full_name text, p_role text, p_expected_updated_at timestamptz
)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT app_private.update_team_member(p_member_id,p_full_name,p_role,p_expected_updated_at);
$$;
REVOKE ALL ON FUNCTION public.update_team_member(uuid,text,text,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_team_member(uuid,text,text,timestamptz) TO authenticated;
NOTIFY pgrst, 'reload schema';
