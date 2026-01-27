/**
 * TempoEngine
 * Handles audio scheduling, precise timing, and web audio context management.
 * Supports: dynamic interval (3s gap), mobile unlock, and background worker.
 */
class TempoEngine {
    constructor(onBeatCallback, onIntervalCallback) {
        // --- Callbacks ---
        this.onBeatCallback = onBeatCallback;         // Triggered on every beat
        this.onIntervalCallback = onIntervalCallback; // Triggered after interval starts

        // --- Audio Context & Nodes ---
        this.audioCtx = null;
        this.masterGainNode = null;

        // --- State ---
        this.isPlaying = false;
        this.currentBeat = 0;
        this.nextNoteTime = 0.0;

        // --- Settings ---
        this.bpm = 60;
        this.ratio = "3:1";
        this.ticksPerCycle = 4; // 3:1 = 4 beats, 2:1 = 3 beats
        this.soundType = "beep";
        this.intervalDuration = 3.0; // Seconds to wait between shots

        // --- Scheduler Config ---
        this.lookahead = 25.0;       // ms
        this.scheduleAheadTime = 0.1; // sec

        // --- Worker (Background Timer) ---
        this.timerWorker = null;
        this.workerFailed = false;
        this.workerFallbackId = null;
    }

    // --- Initialization & Audio Unlock ---
    init() {
        if (this.audioCtx) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();

        this.masterGainNode = this.audioCtx.createGain();
        this.masterGainNode.gain.value = 1.0;
        this.masterGainNode.connect(this.audioCtx.destination);

        this._initWorker();
    }

    _initWorker() {
        if (this.timerWorker || this.workerFailed) return;

        try {
            this.timerWorker = new Worker("./js/worker.js");
            this.timerWorker.onmessage = (e) => {
                if (e.data === "tick") this.scheduler();
            };
            this.timerWorker.onerror = (e) => {
                console.warn("Worker Error. Falling back to main thread.", e);
                this.workerFailed = true;
                this.timerWorker = null;
            };
            this.timerWorker.postMessage({ interval: this.lookahead });
        } catch (e) {
            console.warn("Worker init failed.", e);
            this.workerFailed = true;
        }
    }

    unlock() {
        this.init();
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        // Play silent buffer to warm up audio stack
        const buffer = this.audioCtx.createBuffer(1, 1, 22050);
        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioCtx.destination);
        source.start(0);
    }

    // --- Control Methods ---
    start() {
        this.unlock();
        this.isPlaying = true;
        this.currentBeat = 0;
        this.nextNoteTime = this.audioCtx.currentTime + 0.1; // Start slightly ahead

        if (!this.workerFailed && this.timerWorker) {
            this.timerWorker.postMessage("start");
        } else {
            this.workerFallbackId = window.setInterval(() => this.scheduler(), this.lookahead);
        }
    }

    stop() {
        this.isPlaying = false;

        if (this.timerWorker) {
            this.timerWorker.postMessage("stop");
        }
        if (this.workerFallbackId) {
            clearInterval(this.workerFallbackId);
            this.workerFallbackId = null;
        }
    }

    // --- Settings Setters ---
    setBPM(bpm) { this.bpm = bpm; }

    setRatio(ratio) {
        this.ratio = ratio;
        this.ticksPerCycle = (ratio === "3:1") ? 4 : 3;
    }

    setIntervalDuration(duration) {
        this.intervalDuration = duration;
    }

    setSound(soundType) { this.soundType = soundType; }

    setVolume(value) {
        if (this.masterGainNode) {
            this.masterGainNode.gain.setValueAtTime(value, this.audioCtx.currentTime);
        }
    }

    // --- Core Scheduling Logic ---
    nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += secondsPerBeat;
        this.currentBeat++;

        // Cycle Complete?
        if (this.currentBeat >= this.ticksPerCycle) {
            this.currentBeat = 0;
            // Add dynamic interval (Wait for video finish + 3s)
            this.nextNoteTime += this.intervalDuration;
        }
    }

    scheduleNote(beatNumber, time) {
        // beatNumber: 0 (Start), ..., ticksPerCycle-1 (Impact)
        const isImpact = (beatNumber === this.ticksPerCycle - 1);

        // 1. Visual & Logic Callback (Main Thread)
        // Use setTimeout to sync visual callback with audio time
        const delay = (time - this.audioCtx.currentTime) * 1000;
        setTimeout(() => {
            if (this.isPlaying) {
                this.onBeatCallback(beatNumber, isImpact);
            }
        }, Math.max(0, delay));

        // 2. Play Audio
        this._playSound(isImpact, time);

        // 3. Interval Callback (after Impact)
        if (isImpact && this.onIntervalCallback) {
            const intervalDelay = delay + 100;
            setTimeout(() => {
                if (this.isPlaying) {
                    this.onIntervalCallback();
                }
            }, Math.max(0, intervalDelay));
        }
    }

    scheduler() {
        // Schedule notes until we catch up to scheduleAheadTime
        while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentBeat, this.nextNoteTime);
            this.nextNote();
        }
    }

    // --- Sound Generation ---
    // --- Sound Generation ---
    _playSound(isImpact, time) {
        // Dispatch based on soundType key
        switch (this.soundType) {
            case 'driver1': this._playTitanium(isImpact, time); break;
            case 'driver2': this._playCarbon(isImpact, time); break;
            case 'driver3': this._playProRhythm(isImpact, time); break;
            case 'approach1': this._playWedge(isImpact, time); break;
            case 'approach2': this._playSoftTouch(isImpact, time); break;
            case 'approach3': this._playPrecision(isImpact, time); break;
            default: this._playTitanium(isImpact, time); break; // Fallback
        }
    }

    // --- Reverb (Impulse Response) ---
    _getReverbNode() {
        if (!this.reverbBuffer) {
            // Create a simple impulse response for spatial feel
            const length = this.audioCtx.sampleRate * 0.5; // 0.5 sec tail
            const impulse = this.audioCtx.createBuffer(2, length, this.audioCtx.sampleRate);
            const left = impulse.getChannelData(0);
            const right = impulse.getChannelData(1);
            for (let i = 0; i < length; i++) {
                const decay = Math.pow(1 - i / length, 2);
                left[i] = (Math.random() * 2 - 1) * decay;
                right[i] = (Math.random() * 2 - 1) * decay;
            }
            this.reverbBuffer = impulse;
        }
        const convolver = this.audioCtx.createConvolver();
        convolver.buffer = this.reverbBuffer;

        // Dry/Wet Mix logic would go here, but for simplicity we connect 
        // source -> reverb -> destination AND source -> destination.
        // Or cleaner: source -> masterGain. 
        // To add reverb: source -> reverbGain -> convolver -> masterGain.
        return convolver;
    }

    _connectWithReverb(source, time, duration = 0.5) {
        const reverbGain = this.audioCtx.createGain();
        reverbGain.gain.value = 0.2; // 20% Wet

        const verb = this._getReverbNode();

        source.connect(this.masterGainNode); // Dry
        source.connect(reverbGain);
        reverbGain.connect(verb);
        verb.connect(this.masterGainNode);

        // Garbage collection helper is tricky in WebAudio without letting nodes finish.
        // We rely on simple connections for short sounds.
    }

    // --- Driver Sounds ---

    // Option 1: Power Titanium (High Metallic Crack) - Reduced Gain & Filtered
    _playTitanium(isImpact, time) {
        if (isImpact) {
            // Strong Metallic Crack
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            // Filter to remove harshness (User request)
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(2500, time); // Cut off extreme highs

            osc.frequency.setValueAtTime(400, time);
            osc.frequency.exponentialRampToValueAtTime(3000, time + 0.05);

            // Normalized: Further reduced to 0.4 (40%) per user request
            gain.gain.setValueAtTime(0.4, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

            osc.connect(filter);
            filter.connect(gain);

            this._connectWithReverb(gain, time);

            osc.start(time);
            osc.stop(time + 0.3);
        } else {
            // High Tick
            this._playHighTick(time);
        }
    }

    // Option 2: Modern Matrix (Punchy & Digital) - Replaces Carbon
    _playCarbon(isImpact, time) {
        // Renamed logic to "Modern Matrix", but keeping method name to avoid breaking references
        if (isImpact) {
            // Punchy Digital Impact
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            // Fast sweep for "Laser" punch
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, time);
            osc.frequency.exponentialRampToValueAtTime(100, time + 0.2);

            // Louder Gain: Boosted to 1.5 (150%) per user request
            gain.gain.setValueAtTime(1.5, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

            osc.connect(gain);
            this._connectWithReverb(gain, time);

            osc.start(time);
            osc.stop(time + 0.3);
        } else {
            // Sharp Tick
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(600, time);

            gain.gain.setValueAtTime(0.5, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

            osc.connect(gain);
            gain.connect(this.masterGainNode);
            osc.start(time);
            osc.stop(time + 0.1);
        }
    }

    // Option 3: Pro Rhythm (Woodblock)
    _playProRhythm(isImpact, time) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        // Woodblock body
        osc.frequency.setValueAtTime(isImpact ? 1200 : 800, time);

        // Boosted to 1.0 (100%) for Impact
        gain.gain.setValueAtTime(isImpact ? 1.0 : 0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + (isImpact ? 0.15 : 0.05));

        osc.connect(gain);
        // Add slight reverb only on impact
        if (isImpact) this._connectWithReverb(gain, time);
        else gain.connect(this.masterGainNode);

        osc.start(time);
        osc.stop(time + 0.2);
    }

    // --- Approach Sounds ---

    // Option 1: Crispy Wedge (Click ... Slice)
    _playWedge(isImpact, time) {
        if (isImpact) {
            // White Noise Burst (Grass Slice)
            const bufferSize = this.audioCtx.sampleRate * 0.2; // 0.2 sec
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = this.audioCtx.createBufferSource();
            noise.buffer = buffer;

            const noiseGain = this.audioCtx.createGain();
            // Normalized: Boosted slightly (0.6 -> 0.7)
            noiseGain.gain.setValueAtTime(0.7, time);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

            // Filter to make it "crisp"
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = "highpass";
            filter.frequency.value = 1000;

            noise.connect(filter);
            filter.connect(noiseGain);
            this._connectWithReverb(noiseGain, time);

            noise.start(time);
            noise.stop(time + 0.2);
        } else {
            // Dry Click
            this._playClick(time);
        }
    }

    // Option 2: Pure Glass (Clear & Bright) - Boosted Gain
    _playSoftTouch(isImpact, time) {
        if (isImpact) {
            // Glassy Ping
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, time);

            // Normalized: Significant Boost (0.6 -> 1.2) for visibility
            gain.gain.setValueAtTime(1.2, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

            osc.connect(gain);
            this._connectWithReverb(gain, time);

            osc.start(time);
            osc.stop(time + 0.4);
        } else {
            // Clear Drip
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, time);
            gain.gain.setValueAtTime(0.5, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
            osc.connect(gain);
            gain.connect(this.masterGainNode);
            osc.start(time);
            osc.stop(time + 0.15);
        }
    }

    // Option 3: Precision Click (Digital)
    _playPrecision(isImpact, time) {
        // High Precision Beep
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'square';

        if (isImpact) {
            osc.frequency.setValueAtTime(1500, time);
            // Normalized: Slight boost (0.5 -> 0.6)
            gain.gain.setValueAtTime(0.6, time);
        } else {
            osc.frequency.setValueAtTime(1000, time);
            gain.gain.setValueAtTime(0.3, time);
        }

        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05); // Very short

        osc.connect(gain);
        gain.connect(this.masterGainNode);

        osc.start(time);
        osc.stop(time + 0.1);
    }

    // Helpers
    _playHighTick(time) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.frequency.setValueAtTime(800, time);
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
        osc.connect(gain);
        gain.connect(this.masterGainNode);
        osc.start(time);
        osc.stop(time + 0.1);
    }

    _playClick(time) {
        // Impulse click
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, time);
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
        osc.connect(gain);
        gain.connect(this.masterGainNode);
        osc.start(time);
        osc.stop(time + 0.05);
    }

    // Fanfare for Celebration
    playFanfare() {
        if (!this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        // C major arpeggio
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(this.masterGainNode);

            osc.frequency.value = freq;
            osc.type = 'triangle';
            gain.gain.setValueAtTime(0.5, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);

            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        });
    }
}
