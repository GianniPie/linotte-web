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
        if (this.mode === "offline") {
            this.localAction(action);
        }
        if (this.mode === "online") {
            this.socket.emit("action", action);
        }
        if (this.mode === "bot") {
            this.localAction(action);
            this.botMove();
        }
    }

    localAction(action) {
        this.state = updateGame(this.state, action);
    }

    botMove() {
        if (this.state.currentPlayer !== 2) return;
        const action = botChooseAction(this.state);
        this.localAction(action);
    }
}