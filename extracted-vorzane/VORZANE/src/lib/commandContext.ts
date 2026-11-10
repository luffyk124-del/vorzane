export type CommandOwnerSnapshot = {
  userId: string;
  generation: number;
};

export function isCurrentCommandOwner(
  request: CommandOwnerSnapshot,
  current: { userId: string | null; generation: number },
): boolean {
  return request.userId.length > 0 &&
    request.userId === current.userId &&
    request.generation === current.generation;
}
