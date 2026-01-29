document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. CONSTANTS & DOM ELEMENTS
    // =========================================================================
    const IMPACT_TIMES = { "3:1": 1.90, "2:1": 2.433 };
    const BPM_SETTINGS = {
        "3:1": { min: 100, max: 220, default: 145 },
        "2:1": { min: 80, max: 180, default: 125 }
    };

    const ui = {
        startBtn: document.getElementById('start-btn'),
        bpmSlider: document.getElementById('bpm-slider'),
        bpmMinus: document.getElementById('bpm-minus'),
        bpmPlus: document.getElementById('bpm-plus'),
        bpmDisplay: document.getElementById('neon-bpm-value'),
        volSlider: document.getElementById('volume-slider'),
        volMinus: document.getElementById('vol-minus'),
        volPlus: document.getElementById('vol-plus'),
        video: document.getElementById('swing-video'),
        dots: Array.from(document.querySelectorAll('.beat-dots .dot')),
        swingCountDisplay: document.getElementById('swing-count-display'),
        ratioBtns: document.querySelectorAll('.toggle-btn[data-ratio]'),
        statusOverlay: document.getElementById('status-overlay'),
        statusText: document.getElementById('status-text'),
        settingsToggle: document.getElementById('settings-toggle'),
        settingsMenu: document.getElementById('settings-menu'),
        closeSettingsBtn: document.getElementById('close-settings-btn'),
        wakeLockBtn: document.getElementById('wake-lock-btn'),
        controlsContainer: document.querySelector('.controls-container')
    };

    // =========================================================================
    // 2. STATE MANAGEMENT
    // =========================================================================
    let swingCount = 0;
    let videoSyncTimeout = null;
    let isFirstPlay = true;
    let wakeLock = null;

    // =========================================================================
    // 3. CORE ENGINE & CALLBACKS
    // =========================================================================
    const onBeat = (beatNumber, isImpact) => {
        _updateVisualDots(beatNumber, isImpact);
        if (isImpact) _triggerImpactEffects();
        if (ui.video && beatNumber === 0) _handleSwingStart();
    };

    const onIntervalStart = () => {
        // This callback now primarily ensures that any pending video playback scheduled
        // by the previous swing is cancelled before the new one starts.
        // The "샷 준비" UI is now triggered by the 'ended' event of the video itself.
        if (videoSyncTimeout) {
            clearTimeout(videoSyncTimeout);
            videoSyncTimeout = null;
        }
    };

    const engine = new TempoEngine(onBeat, onIntervalStart);

    // =========================================================================
    // 4. LOGIC & HANDLERS
    // =========================================================================

    // --- Core Logic ---
    const _handleSwingStart = () => {
        if (ui.statusOverlay) ui.statusOverlay.classList.remove('visible');
        if (videoSyncTimeout) clearTimeout(videoSyncTimeout);
        if (!ui.video || !engine.bpm) return;

        const { rate, delay } = _calculateSyncParams(engine.bpm);

        videoSyncTimeout = setTimeout(() => {
            if (!ui.video) return;
            ui.video.playbackRate = rate;
            ui.video.currentTime = 0;
            const playPromise = ui.video.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => console.warn("Video play failed:", error));
            }
        }, delay > 0 ? delay : 1);
    };

    const _calculateSyncParams = (bpm) => {
        const beatDuration = 60 / bpm;
        const beatsToImpact = (engine.ratio === "2:1") ? 2 : 3;
        const audioImpactTime = beatDuration * beatsToImpact;
        const videoImpactTime = IMPACT_TIMES[engine.ratio] || 1.90;
        let rate = 1.0, delay = 0;

        if (audioImpactTime >= videoImpactTime) {
            delay = (audioImpactTime - videoImpactTime) * 1000;
        } else {
            rate = videoImpactTime / audioImpactTime;
        }
        return { rate, delay };
    };
    
    const _updateIntervalSettings = () => {
        const fallbackInterval = 1.5 + 3.0;
        if (ui.video && ui.video.duration && !isNaN(ui.video.duration)) {
            const impactTime = IMPACT_TIMES[engine.ratio] || 1.90;
            const remaining = ui.video.duration - impactTime;
            engine.setIntervalDuration((remaining > 0 ? remaining : 1.5) + 3.0);
        } else {
             engine.setIntervalDuration(fallbackInterval);
        }
    };

    const _triggerImpactEffects = () => {
        swingCount++;
        _updateSwingCountUI();
    };

    const _updateVisualDots = (beatNumber, isImpact) => {
        requestAnimationFrame(() => {
            ui.dots.forEach(d => d.classList.remove('active', 'impact'));
            let targetIndex = beatNumber;
            if (engine.ratio === "2:1" && beatNumber === 2) targetIndex = 3;

            if (ui.dots[targetIndex]) {
                ui.dots[targetIndex].classList.add('active');
                if (isImpact) {
                    ui.dots[targetIndex].classList.add('impact');
                }
            }
        });
    };

    // --- UI Controllers ---
    const togglePlay = () => {
        engine.unlock();
        if (isFirstPlay && ui.video) {
            isFirstPlay = false;
            ui.video.play().catch(() => {});
            ui.video.pause();
        }

        if (engine.isPlaying) {
            engine.stop();
            ui.startBtn.textContent = "시작";
            ui.startBtn.classList.remove('playing');
            if (videoSyncTimeout) clearTimeout(videoSyncTimeout);
            if (ui.video) {
                ui.video.pause();
                ui.video.currentTime = 0;
            }
            if (ui.statusOverlay) ui.statusOverlay.classList.remove('visible');
        } else {
            _updateIntervalSettings();
            engine.start();
            ui.startBtn.textContent = "중지";
            ui.startBtn.classList.add('playing');
        }
    };
    
    const setMode = (ratioButton) => {
        const ratio = ratioButton.dataset.ratio;
        engine.setRatio(ratio);

        ui.ratioBtns.forEach(b => b.classList.remove('active'));
        ratioButton.classList.add('active');

        const settings = BPM_SETTINGS[ratio];
        if (settings) {
            ui.bpmSlider.min = settings.min;
            ui.bpmSlider.max = settings.max;
            updateBPM(settings.default);
        }

        const isDriver = ratio === "3:1";
        ui.video.src = isDriver ? "img/driver.mp4" : "img/approach.mp4";
        ui.video.load();
        
        if (ui.dots[2]) ui.dots[2].style.display = isDriver ? 'block' : 'none';

        const soundOptions = isDriver
            ? [{ id: 'driver1', label: '드라이버 비프' }, { id: 'driver2', label: '드라이버 휘슬' }, { id: 'driver3', label: '드라이버 메트로놈' }]
            : [{ id: 'approach1', label: '어프로치 비프' }, { id: 'approach2', label: '어프로치 휘슬' }, { id: 'approach3', label: '어프로치 메트로놈' }];
        
        const soundButtons = document.querySelectorAll('.toggle-btn[data-sound]');
        soundButtons.forEach((btn, index) => {
            if (soundOptions[index]) {
                btn.textContent = soundOptions[index].label;
                btn.dataset.sound = soundOptions[index].id;
            }
        });

        soundButtons.forEach(b => b.classList.remove('active'));
        const defaultSoundBtn = soundButtons[2] || soundButtons[0];
        if (defaultSoundBtn) {
            defaultSoundBtn.classList.add('active');
            engine.setSound(defaultSoundBtn.dataset.sound);
        }
    };

    const updateBPM = (val) => {
        const newBPM = Math.max(parseInt(ui.bpmSlider.min), Math.min(parseInt(ui.bpmSlider.max), parseInt(val)));
        ui.bpmSlider.value = newBPM;
        ui.bpmDisplay.textContent = newBPM;
        engine.setBPM(newBPM);
    };

    const updateVolume = (val) => {
        const newVol = Math.max(0, Math.min(100, parseInt(val)));
        ui.volSlider.value = newVol;
        engine.setVolume(newVol / 100);
        try {
            localStorage.setItem('golf_volume', newVol);
        } catch (e) {
            console.warn("Could not save volume to localStorage.", e);
        }
    };

    const _updateSwingCountUI = () => {
        if (ui.swingCountDisplay) ui.swingCountDisplay.textContent = `연습 횟수: ${swingCount}`;
    };
    
    // This function is called when the swing video finishes playing.
    const onVideoEnd = () => {
        // Show the "prepare for next shot" message.
        if (ui.statusOverlay && ui.statusText) {
            ui.statusText.textContent = "샷 준비";
            ui.statusOverlay.classList.add('visible');
        }
    };

    // --- Screen Wake Lock ---
    const toggleWakeLock = async () => {
        if (!('wakeLock' in navigator)) {
            alert('이 브라우저에서는 화면 잠금 방지 기능을 지원하지 않습니다.');
            return;
        }

        if (wakeLock) {
            try {
                await wakeLock.release();
            } catch (err) {
                console.error('Wake Lock release failed:', err);
            }
            wakeLock = null;
            _updateWakeLockUI(false);

        } else {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                _updateWakeLockUI(true);
                wakeLock.addEventListener('release', () => {
                    wakeLock = null;
                    _updateWakeLockUI(false);
                });
            } catch (err) {
                console.error('Wake Lock request failed:', err);
                _updateWakeLockUI(false);
            }
        }
    };
    
    const _updateWakeLockUI = (isActive) => {
         if (!ui.wakeLockBtn) return;
         if (isActive) {
            ui.wakeLockBtn.textContent = "화면 자동 꺼짐 방지: ON";
            ui.wakeLockBtn.classList.add('active');
         } else {
            ui.wakeLockBtn.textContent = "화면 자동 꺼짐 방지: OFF";
            ui.wakeLockBtn.classList.remove('active');
         }
    };

    // =========================================================================
    // 5. EVENT BINDING
    // =========================================================================
    function bindEvents() {
        const addFastClick = (element, callback) => {
            if (element) element.addEventListener('click', callback);
        };

        addFastClick(ui.startBtn, togglePlay);
        addFastClick(ui.volMinus, () => updateVolume(parseInt(ui.volSlider.value) - 5));
        addFastClick(ui.volPlus, () => updateVolume(parseInt(ui.volSlider.value) + 5));
        if (ui.volSlider) ui.volSlider.addEventListener('input', (e) => updateVolume(e.target.value));
        
        addFastClick(ui.bpmMinus, () => updateBPM(parseInt(ui.bpmSlider.value) - 1));
        addFastClick(ui.bpmPlus, () => updateBPM(parseInt(ui.bpmSlider.value) + 1));
        if (ui.bpmSlider) ui.bpmSlider.addEventListener('input', (e) => updateBPM(e.target.value));
        
        if (ui.ratioBtns) ui.ratioBtns.forEach(btn => addFastClick(btn, () => setMode(btn)));

        if (ui.controlsContainer) {
            ui.controlsContainer.addEventListener('click', (e) => {
                if (e.target.matches('.toggle-btn[data-sound]')) {
                    engine.unlock();
                    document.querySelectorAll('.toggle-btn[data-sound]').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    engine.setSound(e.target.dataset.sound);
                }
            });
        }
        
        addFastClick(ui.settingsToggle, () => ui.settingsMenu && ui.settingsMenu.classList.remove('hidden'));
        addFastClick(ui.closeSettingsBtn, () => ui.settingsMenu && ui.settingsMenu.classList.add('hidden'));
        addFastClick(ui.wakeLockBtn, toggleWakeLock);

        if (ui.video) {
            ui.video.addEventListener('loadedmetadata', _updateIntervalSettings);
            ui.video.addEventListener('ended', onVideoEnd);
        }
    }

    // =========================================================================
    // 6. INITIALIZATION
    // =========================================================================
    function initializeApp() {
        if (ui.video) {
            ui.video.muted = true;
            ui.video.playsInline = true;
        }

        try {
            const savedVol = localStorage.getItem('golf_volume');
            updateVolume(savedVol !== null ? savedVol : 100);
        } catch (e) {
            updateVolume(100);
        }

        const driverBtn = document.querySelector('.toggle-btn[data-ratio="3:1"]');
        if (driverBtn) {
            setMode(driverBtn);
        }
        
        _updateSwingCountUI();
        _updateWakeLockUI(wakeLock !== null);

        console.log("App Initialized & Ready.");
    }

    // =========================================================================
    // 7. APP START
    // =========================================================================
    bindEvents();
    initializeApp();
});
