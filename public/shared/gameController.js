import { updateGame } from "../shared/gameEngine.js";

export default class GameController {

    // `socket` is the OnlineClient in "online" mode.
    constructor(mode, socket = null) {
        this.mode = mode;
        this.socket = socket;
        this.state = null;
        // True while the opponent's relayed moves are being replayed on this
        // screen: they update the local state but must never be sent back.
        this.replaying = false;
        // Online dice come from the server: false from the moment this player
        // asks for a roll until the server's numbers have been applied.
        this.rollArrived = true;
    }

    setState(state) {
        this.state = state;
    }

    dispatch(action) {
        if (this.mode === "offline" || this.mode === "bot") {
            // Both modes apply actions locally through the shared game
            // engine. In "bot" mode, the bot's own turn is driven by
            // playBotTurn() in linotte.js, which calls dispatch() the
            // same way the human's click handlers do — so from here,
            // there's no difference between a human move and a bot move.
            this.localAction(action);
        }
        if (this.mode === "online") {
            if (this.replaying) {
                // The opponent's move, already validated and numbered by the
                // server: apply it and stop.
                this.localAction(action);
                return;
            }
            if (action.type === "ROLL_DICE") {
                // Only the server rolls. The faces come back in the relayed
                // action (see applyOwnRoll in linotte.js), so nothing changes
                // locally until then.
                this.rollArrived = false;
                this.socket.sendAction({ type: "ROLL_DICE" });
                return;
            }
            // Everything else is deterministic: apply it right away so the UI
            // answers instantly, and tell the server, which re-checks it.
            this.localAction(action);
            this.socket.sendAction(action);
        }
    }

    localAction(action) {
        this.state = updateGame(this.state, action);
    }
}