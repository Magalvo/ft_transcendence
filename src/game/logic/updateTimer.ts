import { side, type Objects2D, type SceneData } from "../../index.js";

const devil_actuation_time = 10;
const good_actuation_time = 20;
let devil_time: number = 0;
let good_time: number = 0;

/**
 * Updates time, timer label and time events.
 * @param obj2D - 2D UI objects
 * @param data - Scene/game state
 */
export function updateTimer(obj2D: Objects2D, data: SceneData) {
    // advance timer
    data.time += data.step;
    changeGoodSide(data);
    updateTimerLabel(obj2D, data);
    updateDevilTimerLabel(obj2D);
}

function updateTimerLabel(obj2D: Objects2D, data: SceneData) {
    // get total time rounded to to seconds
    const total_seconds = Math.floor(data.time);
    // separate minutes and seconds
    const min = Math.floor(total_seconds / 60);
    const seconds = total_seconds % 60;
    // put a '0' if needed
    const formatted_min = String(min).padStart(2, '0');
    const formatted_seconds = String(seconds).padStart(2, '0');
    // update label
    obj2D.timer_label.text = formatted_min + ":" + formatted_seconds;
}

function updateDevilTimerLabel(obj2D: Objects2D) {
    // get total time rounded to to seconds
    const seconds =
        (devil_time != 0)
            ? devil_actuation_time - devil_time
            : good_actuation_time - good_time;
    // put a '0' if needed
    const formatted_seconds = seconds.toFixed(1);
    // update label
    obj2D.devil_timer_label.text = formatted_seconds;
    obj2D.devil_timer_label.color =
        (devil_time != 0)
            ? "red"
            : "blue"
}

/**
 * Alternate between good and devil side when time comes.
 * @param data - Scene/game state
 */
function changeGoodSide(data: SceneData) {
    // advance good/devil timer
    if (data.good_side == side.right)
        good_time += data.step;
    if (data.good_side == side.left)
        devil_time += data.step;
    // change side
    if (good_time >= good_actuation_time)
        good_time = 0, data.good_side = side.left;
    if (devil_time >= devil_actuation_time)
        devil_time = 0, data.good_side = side.right;
}