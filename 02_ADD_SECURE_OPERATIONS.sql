-- SPORTUNI WELCOME 2026: run ONCE in the same Supabase SQL Editor
-- AFTER the initial database script has completed successfully.
-- Atomic, restricted routines used by Vercel server endpoints.

begin;

create or replace function public.publish_sportuni_question(p_text text, p_admin uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare q public.questions%rowtype;
begin
  if length(btrim(p_text)) not between 1 and 200 then raise exception 'Invalid question'; end if;
  if not exists(select 1 from public.staff_roles where user_id=p_admin and role='admin' and is_active) then
    raise exception 'Admin access required';
  end if;
  perform 1 from public.event_settings where id=1 for update;
  insert into public.questions(text,published_at,created_by) values(btrim(p_text),now(),p_admin) returning * into q;
  update public.event_settings set active_question_id=q.id,screen_mode='qr',updated_at=now() where id=1;
  return jsonb_build_object('ok',true,'question_id',q.id);
end $$;

create or replace function public.submit_sportuni_answer(
  p_question uuid, p_text text, p_hash text, p_submission uuid,
  p_status text, p_source text, p_reason text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.event_settings%rowtype; a public.answers%rowtype;
begin
  if length(btrim(p_text)) not between 1 and 100 or length(p_hash)<>64 then raise exception 'Invalid submission'; end if;
  if p_status not in ('pending','approved','blocked') or p_source not in ('awaiting_review','automatic','human','fallback') then raise exception 'Invalid status'; end if;
  select * into s from public.event_settings where id=1 for share;
  if s.active_question_id is distinct from p_question or not s.intake_enabled then raise exception 'Question changed or intake closed'; end if;
  insert into public.answers(question_id,answer_text,device_hash,submission_id,status,moderation_source,moderation_reason)
  values(p_question,btrim(p_text),p_hash,p_submission,p_status,p_source,p_reason)
  on conflict do nothing returning * into a;
  if a.id is null then
    select * into a from public.answers where question_id=p_question and device_hash=p_hash;
    if a.id is null then raise exception 'Submission token conflict'; end if;
  end if;
  return jsonb_build_object('id',a.id,'status',a.status);
end $$;

create or replace function public.review_sportuni_answer(p_answer uuid,p_status text,p_reviewer uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare changed public.answers%rowtype;
begin
  if p_status not in ('approved','blocked') then raise exception 'Invalid review status'; end if;
  if not exists(select 1 from public.staff_roles where user_id=p_reviewer and role in ('admin','moderator') and is_active) then
    raise exception 'Moderator access required';
  end if;
  update public.answers set status=p_status,moderation_source='human',reviewed_by=p_reviewer,reviewed_at=now()
    where id=p_answer and status='pending' returning * into changed;
  if changed.id is null then return false; end if;
  insert into public.moderation_log(answer_id,previous_status,new_status,changed_by)
    values(p_answer,'pending',p_status,p_reviewer);
  return true;
end $$;

-- Do not grant routines to anonymous/authenticated browser clients.
revoke all on function public.publish_sportuni_question(text,uuid) from public,anon,authenticated;
revoke all on function public.submit_sportuni_answer(uuid,text,text,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.review_sportuni_answer(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.publish_sportuni_question(text,uuid) to service_role;
grant execute on function public.submit_sportuni_answer(uuid,text,text,uuid,text,text,text) to service_role;
grant execute on function public.review_sportuni_answer(uuid,text,uuid) to service_role;
commit;
select 'Secure functions installed' as result;
