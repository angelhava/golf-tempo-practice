document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. CONSTANTS & DOM ELEMENTS
    // =========================================================================
    const BPM_SETTINGS = {
        "3:1": { min: 100, max: 220, default: 145, baseBPM: 145 },
        "2:1": { min: 80, max: 180, default: 125, baseBPM: 125 }
    };

    const VIDEO_IMPACT_TIMES = {
        "3:1": 1.11, // Driver impact time in seconds
        "2:1": 2.12  // Approach impact time in seconds
    };

    const HELP_CONTENT = {
        bpm: {
            title: "템포 (BPM)란?",
            text: "BPM은 분당 비트 수(Beats Per Minute)를 의미하며, 스윙의 빠르기를 조절합니다. 숫자가 높을수록 템포가 빨라집니다. 자신에게 맞는 템포를 찾아 연습해보세요."
        },
        driver: {
            title: "3:1 드라이버 비율",
            text: "백스윙과 다운스윙의 시간 비율을 3:1로 설정합니다. 이는 PGA 투어 프로들의 평균적인 드라이버 스윙 리듬으로, 충분한 백스윙 시간을 확보하여 파워를 극대화하는 데 도움을 줍니다."
        },
        approach: {
            title: "2:1 어프로치 비율",
            text: "백스윙과 다운스윙의 시간 비율을 2:1로 설정합니다. 이는 비교적 짧고 간결한 스윙에 적합하며, 아이언이나 숏게임 어프로치에서 일관된 컨트롤과 정확성을 높이는 데 도움을 줍니다."
        }
    };

    const ui = {
        appContainer: document.querySelector('.app-container'),
        startBtn: document.getElementById('start-btn'),
        bpmSlider: document.getElementById('bpm-slider'),
        bpmMinus: document.getElementById('bpm-minus'),
        bpmPlus: document.getElementById('bpm-plus'),
        bpmDisplay: document.getElementById('bpm-value-display'),
        volSlider: document.getElementById('volume-slider'),
        volMinus: document.getElementById('vol-minus'),
        volPlus: document.getElementById('vol-plus'),
        volumeDisplay: document.getElementById('volume-value-display'),
        video: document.getElementById('swing-video'),
        dots: Array.from(document.querySelectorAll('.beat-dots .dot')),
        swingCountDisplay: document.getElementById('swing-count-display'),
        ratioBtns: document.querySelectorAll('.toggle-btn[data-ratio]'),
        statusOverlay: document.getElementById('status-overlay'),
        statusText: document.getElementById('status-text'),
        countdownText: document.getElementById('countdown-text'),
        settingsToggle: document.getElementById('settings-toggle'),
        settingsMenu: document.getElementById('settings-menu'),
        closeSettingsBtn: document.getElementById('close-settings-btn'),
        wakeLockBtn: document.getElementById('wake-lock-btn'),
        controlsContainer: document.querySelector('.controls-container'),
        neonOverlay: document.getElementById('neon-overlay'),
        helpModal: document.getElementById('help-modal'),
        helpModalTitle: document.getElementById('help-modal-title'),
        helpModalText: document.getElementById('help-modal-text'),
        closeHelpModalBtn: document.getElementById('close-help-modal-btn'),
        helpBtns: document.querySelectorAll('.help-btn')
    };
    
    // =========================================================================
    // 2. STATE MANAGEMENT
    // =========================================================================
    let state = {
        appStatus: 'idle', 
        swingCount: 0,
        isFirstPlay: true,
        wakeLock: null,
        countdownTimer: null,
        videoSyncTimeout: null // Timer for syncing video playback
    };

    // =========================================================================
    // 3. AUDIO ENGINE HOOKS
    // =========================================================================
    const onBeat = (beatNumber, isImpact) => {
        // --- ALL-NEW, RELIABLE VIDEO SYNC LOGIC ---
        if (beatNumber === 0 && ui.video && state.appStatus === 'playing') {
            const ratio = engine.ratio;
            const bpm = engine.bpm;
            const videoImpactTime = VIDEO_IMPACT_TIMES[ratio];
            const playbackRate = ui.video.playbackRate;

            // Time for the video to reach its impact point, considering playback speed
            const timeToImpactVideo = videoImpactTime / playbackRate;

            // Time for the audio to reach its impact point
            const beatsToImpact = (ratio === "3:1") ? 3 : 2;
            const secondsPerBeat = 60.0 / bpm;
            const timeToImpactAudio = beatsToImpact * secondsPerBeat;

            // The difference in time between video and audio impact
            const timeDifference = timeToImpactVideo - timeToImpactAudio;

            // Always clear any previous sync timeout to prevent conflicts
            if (state.videoSyncTimeout) clearTimeout(state.videoSyncTimeout);

            if (timeDifference >= 0) {
                // Video is slower than audio. Delay video start.
                ui.video.currentTime = 0; // Reset video to beginning
                state.videoSyncTimeout = setTimeout(() => {
                    if(state.appStatus === 'playing') {
                        const playPromise = ui.video.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(error => console.warn("Video play failed (delayed):", error));
                        }
                    }
                }, timeDifference * 1000); // Wait for the calculated delay
            } else {
                // Audio is slower than video. Seek video forward.
                // -timeDifference is a positive value representing the seek time
                ui.video.currentTime = -timeDifference; 
                const playPromise = ui.video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => console.warn("Video play failed (seeked):", error));
                }
            }
        }
        // --- END NEW LOGIC ---

        _updateVisualDots(beatNumber, isImpact);
        _triggerNeonFlash(isImpact);
        if (isImpact) _triggerImpactEffects();
    };

    const onIntervalStart = () => {};

    const engine = new TempoEngine(onBeat, onIntervalStart);
    
    // =========================================================================
    // 4. CORE LOGIC & UI
    // =========================================================================

    const _startCountdown = () => {
        _setAppStatus('countdown');
        ui.statusText.textContent = "준비";
        ui.countdownText.textContent = ""; // Clear previous "Go!"
        ui.statusText.classList.remove('hidden');
        ui.countdownText.classList.add('hidden');
        ui.statusOverlay.classList.add('visible');

        if (state.countdownTimer) clearTimeout(state.countdownTimer);

        state.countdownTimer = setTimeout(() => {
            if (state.appStatus !== 'countdown') return;
            ui.statusText.classList.add('hidden');
            ui.countdownText.classList.remove('hidden');
            ui.countdownText.textContent = "Go!";

            state.countdownTimer = setTimeout(() => {
                 if (state.appStatus !== 'countdown') return;
                _startTempo();
            }, 500);
        }, 1000);
    };

    const _startTempo = () => {
        _setAppStatus('playing');
        ui.statusOverlay.classList.remove('visible');
        engine.start();
    };
    
    const _stopEverything = () => {
        _setAppStatus('idle');
        if (state.countdownTimer) {
            clearTimeout(state.countdownTimer);
            state.countdownTimer = null;
        }
        // Clear the video sync timer as well
        if (state.videoSyncTimeout) {
            clearTimeout(state.videoSyncTimeout);
            state.videoSyncTimeout = null;
        }
        engine.stop();
        if (ui.video) {
            ui.video.pause();
            ui.video.currentTime = 0;
        }
        if (ui.neonOverlay) {
            ui.neonOverlay.classList.remove('beat', 'impact');
        }
        ui.startBtn.textContent = "시작";
        ui.startBtn.classList.remove('playing');
        ui.appContainer.classList.remove('is-playing');
        ui.statusOverlay.classList.remove('visible'); 
        _updateVisualDots(-1);
    };

    const _triggerImpactEffects = () => {
        state.swingCount++;
        _updateSwingCountUI();
    };

    const _triggerNeonFlash = (isImpact) => {
        if (!ui.neonOverlay) return;
        const overlay = ui.neonOverlay;
        overlay.classList.remove('beat', 'impact');
        void overlay.offsetWidth; // Force reflow
        requestAnimationFrame(() => {
            overlay.classList.add(isImpact ? 'impact' : 'beat');
        });
    };

    const _updateVisualDots = (beatNumber, isImpact = false) => {
        requestAnimationFrame(() => {
            ui.dots.forEach(d => d.classList.remove('active', 'impact'));
            if (beatNumber < 0) return;
            let targetIndex = beatNumber;
            if (engine.ratio === "2:1" && beatNumber === 2) targetIndex = 3; // Visually map 3rd beat of 2:1 to last dot
            if (ui.dots[targetIndex]) {
                ui.dots[targetIndex].classList.add('active');
                if (isImpact) {
                    ui.dots[targetIndex].classList.add('impact');
                }
            }
        });
    };
    
    const togglePlay = () => {
        if (state.isFirstPlay) {
            engine.unlock();
            if (ui.video) {
                ui.video.play().catch(() => {});
                ui.video.pause();
            }
            state.isFirstPlay = false;
        }

        if (state.appStatus === 'idle') {
            _startCountdown();
            ui.startBtn.textContent = "중지";
            ui.startBtn.classList.add('playing');
            ui.appContainer.classList.add('is-playing');
        } else {
            _stopEverything();
        }
    };

    const setMode = (ratioButton) => {
        if (state.appStatus !== 'idle') _stopEverything();
        
        const soundButtons = document.querySelectorAll('.toggle-btn[data-sound]');
        let activeSoundIndex = -1;
        soundButtons.forEach((btn, index) => {
            if (btn.classList.contains('active')) activeSoundIndex = index;
        });
        if (activeSoundIndex === -1) activeSoundIndex = 2;

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
        const newVideoSrc = isDriver ? "img/driver.mp4" : "img/approach.mp4";

        // --- More robust video source switching ---
        // Checks if the new source is different from the current one before reloading
        if (!ui.video.currentSrc || !ui.video.currentSrc.includes(newVideoSrc)) {
            ui.video.src = newVideoSrc;
            ui.video.load(); // Explicitly load the new source only when it changes
        }
        
        if (ui.dots[2]) ui.dots[2].style.display = isDriver ? 'block' : 'none';

        const soundIds = isDriver ? ['driver1', 'driver2', 'driver3'] : ['approach1', 'approach2', 'approach3'];
        soundButtons.forEach((btn, index) => {
            if (soundIds[index]) btn.dataset.sound = soundIds[index];
        });

        if (soundButtons[activeSoundIndex]) {
            soundButtons.forEach(b => b.classList.remove('active'));
            const newActiveSoundBtn = soundButtons[activeSoundIndex];
            newActiveSoundBtn.classList.add('active');
            engine.setSound(newActiveSoundBtn.dataset.sound);
        }
    };

    const updateBPM = (val) => {
        const newBPM = Math.max(parseInt(ui.bpmSlider.min), Math.min(parseInt(ui.bpmSlider.max), parseInt(val)));
        ui.bpmSlider.value = newBPM;
        if (ui.bpmDisplay) ui.bpmDisplay.textContent = newBPM;
        engine.setBPM(newBPM);

        if (ui.video) {
            const ratio = engine.ratio;
            const baseBPM = BPM_SETTINGS[ratio].baseBPM || BPM_SETTINGS[ratio].default;
            ui.video.playbackRate = newBPM / baseBPM;
        }
    };

    const updateVolume = (val) => {
        const newVol = Math.max(0, Math.min(100, parseInt(val)));
        ui.volSlider.value = newVol;
        if (ui.volumeDisplay) ui.volumeDisplay.textContent = newVol;
        engine.setVolume(newVol / 100);
        try {
            localStorage.setItem('golf_volume', newVol);
        } catch (e) {
            console.warn("Could not save volume to localStorage.", e);
        }
    };

    const openHelpModal = (topic) => {
        let contentTopic = topic;
        if (topic === 'ratio') {
            const activeRatio = engine.ratio === '3:1' ? 'driver' : 'approach';
            contentTopic = activeRatio;
        }
        if (!HELP_CONTENT[contentTopic] || !ui.helpModal) return;

        ui.helpModalTitle.textContent = HELP_CONTENT[contentTopic].title;
        ui.helpModalText.textContent = HELP_CONTENT[contentTopic].text;
        ui.helpModal.classList.remove('hidden');
    };

    const closeHelpModal = () => {
        if (ui.helpModal) ui.helpModal.classList.add('hidden');
    };

    const _updateSwingCountUI = () => {
        if (ui.swingCountDisplay) ui.swingCountDisplay.textContent = `연습 횟수: ${state.swingCount}`;
    };
    
    const onVideoEnd = () => {
        if (state.appStatus !== 'playing') return;
        engine.stop();
        _updateVisualDots(-1);
        // Directly start the next countdown without delay.
        _startCountdown();
    };
    
    const _setAppStatus = (newStatus) => {
        state.appStatus = newStatus;
    }

    const toggleWakeLock = async () => {
        if (!('wakeLock' in navigator)) {
            alert('이 브라우저에서는 화면 잠금 방지 기능을 지원하지 않습니다.');
            return;
        }
        if (state.wakeLock) {
            try {
                await state.wakeLock.release();
                state.wakeLock = null;
            } catch (err) {
                console.error('Wake Lock release failed:', err);
            }
            _updateWakeLockUI(false);
        } else {
            try {
                state.wakeLock = await navigator.wakeLock.request('screen');
                _updateWakeLockUI(true);
                state.wakeLock.addEventListener('release', () => {
                    state.wakeLock = null;
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
                    if (state.isFirstPlay) engine.unlock();
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
            ui.video.addEventListener('ended', onVideoEnd);
        }
        if (ui.helpBtns) {
            ui.helpBtns.forEach(btn => {
                addFastClick(btn, (e) => {
                    e.stopPropagation();
                    openHelpModal(btn.dataset.help);
                });
            });
        }
        addFastClick(ui.closeHelpModalBtn, closeHelpModal);
    }

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
        _updateWakeLockUI(state.wakeLock !== null);
        console.log("App Initialized & Ready.");
    }

    bindEvents();
    initializeApp();
});
