-- Caps save payload size at 256 KB for new and updated rows.
-- NOT VALID: existing rows are not re-checked, so this cannot fail on legacy data.
-- Run VALIDATE CONSTRAINT only after confirming no existing row exceeds the limit.
alter table public.player_saves
  add constraint player_saves_game_state_size
  check (octet_length(game_state::text) <= 262144) not valid;
