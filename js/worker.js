// worker.js
// This worker simply sends a "tick" message based on the specified interval.
// This prevents the timer from throttling when the tab is in the background.

let timerID = null;
let interval = 25; // Default 25ms

self.onmessage = function (e) {
    if (e.data === "start") {
        clearInterval(timerID);
        timerID = setInterval(function () {
            postMessage("tick");
        }, interval);
    } else if (e.data === "stop") {
        clearInterval(timerID);
        timerID = null;
    } else if (e.data.interval) {
        interval = e.data.interval;
        if (timerID) {
            clearInterval(timerID);
            timerID = setInterval(function () {
                postMessage("tick");
            }, interval);
        }
    }
};
