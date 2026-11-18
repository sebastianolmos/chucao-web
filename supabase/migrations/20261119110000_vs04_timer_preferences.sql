alter table public.profiles
  add column default_timer_minutes smallint,
  add column completion_sound_enabled boolean,
  add column sound_volume smallint,
  add column reduced_motion boolean;

alter table public.profiles
  add constraint profiles_default_timer_minutes_check
    check (
      default_timer_minutes is null
      or default_timer_minutes between 1 and 59
    ),
  add constraint profiles_sound_volume_check
    check (
      sound_volume is null
      or sound_volume between 0 and 100
    );

comment on column public.profiles.default_timer_minutes is
  'Account default practice timer duration in whole minutes (1-59); null uses the product default.';
comment on column public.profiles.completion_sound_enabled is
  'Whether the completion sound is enabled; null uses the product default.';
comment on column public.profiles.sound_volume is
  'Completion sound volume on the user-facing 0-100 scale; null uses the product default.';
comment on column public.profiles.reduced_motion is
  'Explicit reduced-motion override; null follows the browser or operating-system preference.';

grant update (
  default_timer_minutes,
  completion_sound_enabled,
  sound_volume,
  reduced_motion
) on table public.profiles to authenticated;
