-- One-time reset of every account's game progress. Authentication and social data are untouched.
with clock as (
  select
    (extract(epoch from clock_timestamp()) * 1000)::bigint as now_ms,
    to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD') as today,
    to_char(now() at time zone 'utc', 'YYYY-MM') as month_key,
    to_char(date_trunc('week', now() at time zone 'utc')::date, 'YYYY-MM-DD') as week_key
),
fresh_states as (
  select
    u.id as user_id,
    jsonb_build_object(
      'hero', null,
      'characterStyle', jsonb_build_object(
        'gender', 'male', 'appearance', 0, 'hairstyle', 'short',
        'hairColor', 'obsidian', 'face', 'classic', 'outfit', 'adventurer', 'body', 'balanced'
      ),
      'missionPeriods', jsonb_build_object(
        'daily', jsonb_build_object('key', c.today, 'baseline', jsonb_build_object('wins', 0, 'expeditions', 0, 'level', 1), 'claimed', '{}'::jsonb),
        'weekly', jsonb_build_object('key', c.week_key, 'baseline', jsonb_build_object('wins', 0, 'expeditions', 0, 'level', 1), 'claimed', '{}'::jsonb),
        'season', jsonb_build_object('key', c.month_key, 'baseline', jsonb_build_object('wins', 0, 'expeditions', 0, 'level', 1), 'claimed', '{}'::jsonb)
      ),
      'roaming', jsonb_build_object(
        'health', 100, 'maxHealth', 100, 'fragments', 0, 'fragmentsCollected', 0,
        'fragmentProgress', 0, 'eventsCompleted', 0, 'healthUpdatedAt', c.now_ms,
        'storyFlags', '[]'::jsonb, 'fairyNextAt', 0, 'fairyReunited', false,
        'echoStarted', false, 'echoStage', 0, 'echoFailures', 0, 'echoNextAt', 0,
        'echoRoute', null, 'eventsSeen', '[]'::jsonb, 'activeChain', null,
        'chainStage', 0, 'chainRoute', null, 'chainNextAtEvent', 0,
        'lastEventAt', 0, 'merchantRefreshAt', 0, 'gemRefillDate', c.today, 'gemRefillsUsed', 0
      ),
      'dimas', jsonb_build_object('highestFloor', 0, 'claimedMilestones', '[]'::jsonb, 'lastCompletedAt', 0),
      'longQuestStartedAt', c.now_ms,
      'claimedLongQuestIds', '[]'::jsonb,
      'profileAvatarId', 'brand',
      'gold', 500,
      'gems', 50,
      'inventory', '[]'::jsonb,
      'equipped', '{}'::jsonb,
      'pets', '[]'::jsonb,
      'activePet', null,
      'tower', 0,
      'story', 0,
      'dungeonFloor', 1,
      'battleWinsByMode', jsonb_build_object('cave', 0, 'dungeon', 0, 'tower', 0, 'hard', 0, 'roaming', 0),
      'battles', 0,
      'wins', 0,
      'expeditionsCompleted', 0,
      'quests', jsonb_build_object('first', false, 'battles', false, 'level', false),
      'achievements', jsonb_build_object('first', false, 'level', false, 'wins', false),
      'claimedQuestRewards', '{}'::jsonb,
      'activeExpedition', null,
      'expeditionQueue', '[]'::jsonb,
      'offlineSummary', '[]'::jsonb,
      'lastSeenAt', c.now_ms,
      'settings', jsonb_build_object('sfx', true, 'volume', 20, 'musicEnabled', true, 'musicVolume', 24),
      'serverResetEpoch', gen_random_uuid()::text
    ) as game_state
  from auth.users u
  cross join clock c
)
insert into public.player_saves(user_id, game_state, updated_at)
select user_id, game_state, now()
from fresh_states
on conflict (user_id) do update
set game_state = excluded.game_state,
    updated_at = excluded.updated_at;

delete from public.player_command_receipts;
