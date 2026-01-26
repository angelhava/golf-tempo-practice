class TempoEngine {
    constructor(onBeatCallback) {
        this.audioCtx = null;
        this.masterGainNode = null; // Master Volume Control
        this.isPlaying = false;
        this.bpm = 60;
        this.lookahead = 25.0; // How frequently to call scheduling (ms)
        this.scheduleAheadTime = 0.1; // How far ahead to schedule audio (sec)
        this.nextNoteTime = 0.0; // when the next note is due
        this.currentBeat = 0;

        // Timer Worker
        this.timerWorker = null;

        // Ratio Settings
        this.ratio = "3:1";
        this.ticksPerCycle = 4;

        // Sound Type
        this.soundType = "beep";

        this.onBeatCallback = onBeatCallback;
    }

    init() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();

            // Create Master Gain
            this.masterGainNode = this.audioCtx.createGain();
            this.masterGainNode.gain.value = 1.0; // Default maximized for Voice
            this.masterGainNode.connect(this.audioCtx.destination);
        }

        if (!this.timerWorker) {
            this.timerWorker = new Worker("./js/worker.js");
            this.timerWorker.onmessage = (e) => {
                if (e.data === "tick") {
                    this.scheduler();
                }
            };
            this.timerWorker.postMessage({ interval: this.lookahead });
        }
    }

    setBPM(bpm) {
        this.bpm = bpm;
    }

    setRatio(ratio) {
        this.ratio = ratio;
        this.ticksPerCycle = (ratio === "3:1") ? 4 : 3;
    }

    setSound(soundType) {
        if (this.soundType === 'voice' && soundType !== 'voice') {
            window.speechSynthesis.cancel();
        }
        this.soundType = soundType;
    }

    setVolume(value) {
        // Value 0.0 to 1.0
        if (this.masterGainNode) {
            // AudioParam.value set
            this.masterGainNode.gain.setValueAtTime(value, this.audioCtx.currentTime);
        }
    }

    start() {
        this.init();
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        // Ensure no leftover speech
        window.speechSynthesis.cancel();

        this.isPlaying = true;
        this.currentBeat = 0;
        this.nextNoteTime = this.audioCtx.currentTime + 0.1;

        // Start Worker Timer
        this.timerWorker.postMessage("start");
    }

    stop() {
        this.isPlaying = false;
        // Stop Worker Timer
        if (this.timerWorker) {
            this.timerWorker.postMessage("stop");
        }

        // Stop any ongoing speech
        window.speechSynthesis.cancel();
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += secondsPerBeat;
        this.currentBeat++;
        if (this.currentBeat >= this.ticksPerCycle) {
            this.currentBeat = 0;
        }
    }

    scheduleNote(beatNumber, time) {
        const isImpact = (beatNumber === this.ticksPerCycle - 1);

        // Visual Callback
        const delay = (time - this.audioCtx.currentTime) * 1000;
        setTimeout(() => {
            if (this.isPlaying) {
                this.onBeatCallback(beatNumber, isImpact);
            }
        }, Math.max(0, delay));

        // Play Audio
        if (this.soundType === 'metronome') {
            this.playMetronome(beatNumber, isImpact, time);
        } else if (this.soundType === 'whistle') {
            this.playWhistle(isImpact, time);
        } else {
            this.playBeep(isImpact, time);
        }
    }

    scheduler() {
        while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentBeat, this.nextNoteTime);
            this.nextNote();
        }

        // Fallback re-trigger if worker is not used
        if (this.isPlaying && !this.workerEnabled) {
            this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
        }
    }

    // --- Sound Generators ---

    playBeep(isImpact, time) {
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(this.masterGainNode); // Connect to Master

        if (isImpact) {
            osc.frequency.value = 1200;
            gainNode.gain.value = 1.0;
        } else {
            osc.frequency.value = 440;
            gainNode.gain.value = 0.3;
        }

        osc.start(time);
        osc.stop(time + 0.1);
    }

    playWhistle(isImpact, time) {
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.connect(gainNode);
        gainNode.connect(this.masterGainNode); // Connect to Master

        if (isImpact) {
            osc.frequency.setValueAtTime(800, time);
            osc.frequency.exponentialRampToValueAtTime(1200, time + 0.1);
            gainNode.gain.value = 1.0;
        } else {
            osc.frequency.value = 600;
            gainNode.gain.value = 0.2;
        }

        osc.start(time);
        osc.stop(time + 0.15);
    }

    playMetronome(beatNumber, isImpact, time) {
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(this.masterGainNode);

        // Woodblock-ish sound: Square wave with low pass filter or just high pitch sine with short decay
        // Simple synthetic click
        osc.type = 'square';

        if (isImpact) {
            // High pitch woodblock "Tock"
            osc.frequency.setValueAtTime(1500, time);
            gainNode.gain.setValueAtTime(1.0, time);
            gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        } else {
            // Low pitch woodblock "Tick"
            osc.frequency.setValueAtTime(800, time);
            gainNode.gain.setValueAtTime(1.0, time); // High initial attack
            gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.1); // Short decay
        }

        osc.start(time);
        osc.stop(time + 0.1);
    }
}
