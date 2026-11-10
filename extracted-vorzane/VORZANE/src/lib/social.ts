import { supabase } from "./supabase";

export type PlayerProfile = {
  user_id: string;
  display_name: string;
  avatar_id: string;
  is_searchable: boolean;
  created_at: string;
};

export type PublicPlayerProfile = {
  user_id: string;
  display_name: string;
  avatar_id: string;
  character_gender: "male" | "female";
  hero_name: string;
  class_name: string;
  level: number;
  stats: Record<string, number>;
  equipped: Record<string, { name?: string; rarity?: string; bonus?: Record<string, number> } | null>;
  active_pet: string | null;
  wins: number;
  battles: number;
  dimas_floor: number;
  roaming_events: number;
};

export type PlayerSearchResult = {
  user_id: string;
  display_name: string;
  avatar_id: string;
  friend_state: "none" | "incoming" | "outgoing" | "friends";
};

export type FriendSummary = {
  user_id: string;
  display_name: string;
  avatar_id: string;
  friends_since: string;
};

export type IncomingFriendRequest = {
  request_id: string;
  requester_id: string;
  display_name: string;
  avatar_id: string;
  requested_at: string;
};

export type PlayerNotification = {
  notification_id: string;
  notification_type: "friend_request" | "friend_request_accepted";
  actor_name: string;
  created_at: string;
  read_at: string | null;
  friend_request_id: string;
};

function requireData<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("لم تصل بيانات من خدمة الأصدقاء.");
  return data;
}

export async function getMyProfile(userId: string): Promise<PlayerProfile | null> {
  const { data, error } = await supabase
    .from("player_profiles")
    .select("user_id, display_name, avatar_id, is_searchable, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as PlayerProfile | null;
}

export async function getPublicPlayerProfile(userId: string): Promise<PublicPlayerProfile | null> {
  const { data, error } = await supabase.rpc("get_public_player_profile", { p_user_id: userId });
  if (error) throw new Error(error.message);
  return data as PublicPlayerProfile | null;
}

export async function saveMyProfile(displayName: string, avatarId: string): Promise<PlayerProfile> {
  const { data, error } = await supabase.rpc("upsert_my_profile", {
    p_display_name: displayName,
    p_avatar_id: avatarId,
  });
  return requireData(data as PlayerProfile | null, error);
}

export async function setMyProfileSearchable(enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_my_profile_searchable", { p_enabled: enabled });
  if (error) throw new Error(error.message);
}

export async function searchPlayers(query: string): Promise<PlayerSearchResult[]> {
  const { data, error } = await supabase.rpc("search_players", { p_query: query });
  return requireData((data ?? []) as PlayerSearchResult[], error);
}

export async function sendFriendRequest(recipientId: string): Promise<string> {
  const { data, error } = await supabase.rpc("send_friend_request", { p_recipient_id: recipientId });
  return requireData(data as string | null, error);
}

export async function respondToFriendRequest(requestId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc("respond_friend_request", {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) throw new Error(error.message);
}

export async function removeFriend(friendId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_friend", { p_friend_id: friendId });
  if (error) throw new Error(error.message);
}

export async function listMyFriends(): Promise<FriendSummary[]> {
  const { data, error } = await supabase.rpc("list_my_friends");
  return requireData((data ?? []) as FriendSummary[], error);
}

export async function listIncomingFriendRequests(): Promise<IncomingFriendRequest[]> {
  const { data, error } = await supabase.rpc("list_incoming_friend_requests");
  return requireData((data ?? []) as IncomingFriendRequest[], error);
}

export async function listMyNotifications(): Promise<PlayerNotification[]> {
  const { data, error } = await supabase.rpc("list_my_notifications");
  return requireData((data ?? []) as PlayerNotification[], error);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_notification_read", { p_notification_id: notificationId });
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.rpc("mark_all_notifications_read");
  if (error) throw new Error(error.message);
}
