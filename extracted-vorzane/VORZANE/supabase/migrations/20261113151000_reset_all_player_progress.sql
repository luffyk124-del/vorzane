-- Reset gameplay progress for every existing account without deleting accounts or social data.
-- A shared server-issued epoch invalidates stale offline snapshots on every device.

do $reset$
declare
  reset_epoch uuid := gen_random_uuid();
  reset_time bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  fresh_state jsonb;
begin
  fresh_state := jsonb_build_object(
    'serverResetEpoch', reset_epoch::text,
    'hero', null,
    'characterStyle', jsonb_build_object('gender','male','appearance',0,'hairstyle','short','hairColor','obsidian','face','classic','outfit','adventurer','body','balanced'),
    'missionPeriods', jsonb_build_object(
      'daily', jsonb_build_object('key',to_char(current_date,'YYYY-MM-DD'),'baseline',jsonb_build_object('wins',0,'expeditions',0,'level',1),'claimed','{}'::jsonb),
      'weekly', jsonb_build_object('key',to_char(date_trunc('week', current_date),'YYYY-MM-DD'),'baseline',jsonb_build_object('wins',0,'expeditions',0,'level',1),'claimed','{}'::jsonb),
      'season', jsonb_build_object('key',to_char(current_date,'YYYY-MM'),'baseline',jsonb_build_object('wins',0,'expeditions',0,'level',1),'claimed','{}'::jsonb)
    ),
    'roaming', jsonb_build_object('health',100,'maxHealth',100,'fragments',0,'fragmentsCollected',0,'fragmentProgress',0,'eventsCompleted',0,'healthUpdatedAt',reset_time,'storyFlags','[]'::jsonb,'fairyNextAt',0,'fairyReunited',false,'echoStarted',false,'echoStage',0,'echoFailures',0,'echoNextAt',0,'echoRoute',null,'eventsSeen','[]'::jsonb,'activeChain',null,'chainStage',0,'chainRoute',null,'chainNextAtEvent',0,'lastEventAt',0,'merchantRefreshAt',0,'gemRefillDate',to_char(current_date,'YYYY-MM-DD'),'gemRefillsUsed',0),
    'dimas', jsonb_build_object('highestFloor',0,'claimedMilestones','[]'::jsonb,'lastCompletedAt',0),
    'longQuestStartedAt',reset_time,
    'claimedLongQuestIds','[]'::jsonb,
    'profileAvatarId','brand',
    'gold',500,
    'gems',50,
    'inventory','[]'::jsonb,
    'equipped','{}'::jsonb,
    'pets','[]'::jsonb,
    'activePet',null,
    'tower',0,
    'story',0,
    'dungeonFloor',1,
    'battleWinsByMode',jsonb_build_object('cave',0,'dungeon',0,'tower',0,'hard',0,'roaming',0),
    'battles',0,
    'wins',0,
    'expeditionsCompleted',0,
    'quests',jsonb_build_object('first',false,'battles',false,'level',false),
    'achievements',jsonb_build_object('first',false,'level',false,'wins',false),
    'claimedQuestRewards','{}'::jsonb,
    'activeExpedition',null,
    'expeditionQueue','[]'::jsonb,
    'offlineSummary','[]'::jsonb,
    'lastSeenAt',reset_time,
    'settings',jsonb_build_object('sfx',true,'volume',20,'musicEnabled',true,'musicVolume',24)
  );

  -- Reset existing saves in place, preserving account IDs and all social/profile rows.
  update public.player_saves
  set game_state = fresh_state;

  -- Ensure every existing Auth account has a fresh save, including accounts
  -- that did not yet have a player_saves row.
  insert into public.player_saves (user_id, game_state)
  select id, fresh_state
  from auth.users
  on conflict (user_id) do nothing;

  -- Old command receipts and recovery snapshots must not replay pre-reset progress.
  delete from public.player_command_receipts;

  if to_regclass('public.player_save_recovery') is not null then
    execute 'delete from public.player_save_recovery';
  end if;

  if to_regclass('vorzane_internal.player_save_recovery_quotas') is not null then
    execute 'delete from vorzane_internal.player_save_recovery_quotas';
  end if;
end
$reset$;

do $verify$
begin
  if exists (
    select 1 from auth.users u
    left join public.player_saves s on s.user_id = u.id
    where s.user_id is null
  ) then
    raise exception 'Progress reset verification failed: an existing account has no player save.';
  end if;

  if exists (
    select 1 from public.player_saves
    where game_state ->> 'gold' <> '500'
       or game_state ->> 'gems' <> '50'
       or game_state -> 'hero' <> 'null'::jsonb
       or game_state -> 'inventory' <> '[]'::jsonb
       or game_state -> 'pets' <> '[]'::jsonb
       or game_state -> 'equipped' <> '{}'::jsonb
       or coalesce(game_state ->> 'serverResetEpoch','') = ''
  ) then
    raise exception 'Progress reset verification failed: a save does not contain the fresh baseline.';
  end if;

  if exists (select 1 from public.player_command_receipts) then
    raise exception 'Progress reset verification failed: stale command receipts remain.';
  end if;

  if to_regclass('public.player_save_recovery') is not null
     and exists (select 1 from public.player_save_recovery) then
    raise exception 'Progress reset verification failed: stale recovery snapshots remain.';
  end if;

  if to_regclass('vorzane_internal.player_save_recovery_quotas') is not null
     and exists (select 1 from vorzane_internal.player_save_recovery_quotas) then
    raise exception 'Progress reset verification failed: recovery quotas remain.';
  end if;
end
$verify$;
