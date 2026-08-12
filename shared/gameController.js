import { updateGame } from "../shared/gameEngine.js";

export default class GameController {

    constructor(mode, socket = null) {
        this.mode = mode;
        this.socket = socket;
        this.state = null;
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
            this.socket.emit("action", action);
        }
    }

    localAction(action) {
        this.state = updateGame(this.state, action);
    }
}