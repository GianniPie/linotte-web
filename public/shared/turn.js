// Shared by the game server and the app.
// A player on turn who loses the connection keeps their clock: it is held while
// they are away, for at most this long a time (so nobody can stall a game by
// disconnecting), and given back when they return (server/room.js, freezeTurn).
export const TURN_FREEZE_CAP_MS = 20 * 1000;
