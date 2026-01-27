document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. CONSTANTS & SETTINGS
    // =========================================================================

    // Impact times (seconds) for video sync
    const IMPACT_TIMES = {
        "3:1": 1.90,  // Driver
        "2:1": 2.433  // Approach
    };

    // BPM Settings (Range & Default)
    const BPM_SETTINGS = {
        "3:1": { min: 100, max: 220, default: 145 },
        "2:1": { min: 80, max: 180, default: 125 }
    };

    const HELP_DATA = {
        'ratio': {
            title: "스윙 비율 (Swing Ratio)",
            text: "• 3:1 (드라이버): 비거리를 위한 프로들의 표준 리듬입니다.\n• 2:1 (어프로치): 정확한 타격과 가속을 위한 간결한 리듬입니다."
        },
        'bpm': {
            // Dynamic content handling in click event
        }
    };

    // =========================================================================
    // 2. DOM ELEMENTS
    // =========================================================================

    const ui = {
        // Controls
        startBtn: document.getElementById('start-btn'),
        bpmSlider: document.getElementById('bpm-slider'),
        bpmMinus: document.getElementById('bpm-minus'),
        bpmPlus: document.getElementById('bpm-plus'),
        bpmDisplay: document.getElementById('neon-bpm-value'),
        volSlider: document.getElementById('volume-slider'),
        volValue: document.getElementById('volume-value'),
        volMinus: document.getElementById('vol-minus'),
        volPlus: document.getElementById('vol-plus'),

        // Visuals
        visualArea: document.getElementById('visual-area'),
        videoContainer: document.getElementById('video-container'),
        video: document.getElementById('swing-video'),
        impactOverlay: document.querySelector('.impact-overlay'),
        dots: [
            document.getElementById('beat-dot-1'),
            document.getElementById('beat-dot-2'),
            document.getElementById('beat-dot-3'),
            document.getElementById('beat-dot-4')
        ],
        swingCountDisplay: document.getElementById('swing-count-display'),

        // Menus & Modals
        settingsToggle: document.getElementById('settings-toggle'),
        settingsMenu: document.getElementById('settings-menu'),
        wakeLockBtn: document.getElementById('wake-lock-btn'),
        resetCountBtn: document.getElementById('reset-count-btn'),
        helpModal: document.getElementById('help-modal'),
        closeModal: document.getElementById('close-modal'),
        modalTitle: document.getElementById('modal-title'),
        modalText: document.getElementById('modal-text'),
        helpIcons: document.querySelectorAll('.help-icon'),

        // Groups
        ratioBtns: document.querySelectorAll('.toggle-btn[data-ratio]'),
        soundBtns: document.querySelectorAll('.toggle-btn[data-sound]')
    };

    // Use a variable for dynamic Prep Text element
    let prepTextEl = null;

    // =========================================================================
    // 3. STATE MANAGEMENT
    // =========================================================================

    let swingCount = 0;
    let wakeLock = null;
    let videoSyncTimeout = null;

    // =========================================================================
    // 4. CORE ENGINE & CALLBACKS
    // =========================================================================

    /**
     * Beat Callback (Triggered by Engine)
     * Handles visual updates (Dots) and Video Sync logic
     */
    const onBeat = (beatNumber, isImpact) => {
        _updateVisualDots(beatNumber);

        // Visual Flash Effects
        if (isImpact) {
            _triggerImpactEffects();
        } else {
            // Normal Beats (Cyan Flash)
            if (ui.visualArea) {
                ui.visualArea.classList.add('flash-beat');
                setTimeout(() => ui.visualArea.classList.remove('flash-beat'), 150);
            }
        }

        // Video Sync Logic
        if (ui.video) {
            if (beatNumber === 0) {
                _handleSwingStart();
            } else if (isImpact) {
                ui.video.playbackRate = 1.0;
            }
        }
    };



    /**
     * Interval Callback (Triggered after Impact)
     * Handles the "Finish" state waiting logic
     * Note: Actual waiting is handled by engine.intervalDuration
     */
    const onIntervalStart = () => {
        // We let the video play to finish.
        // The preparation text will be shown when video ends (via 'ended' event)
    };

    // Initialize Engine
    const engine = new TempoEngine(onBeat, onIntervalStart);

    // --- Core Logic Helpers ---

    const _updateVisualDots = (beatNumber) => {
        ui.dots.forEach(d => d.classList.remove('active'));
        let targetIndex = beatNumber;
        // Fix for 2:1 mode (Cycle 3 beats: 0, 1, 2)
        // If beatNumber is 2 (Impact in 2:1), map to 4th dot (index 3) for visual consistency?
        // Or kept straightforward as 0,1,2.
        // Previous logic: if (engine.ratio === "2:1" && beatNumber === 2) targetDotIndex = 3;
        if (engine.ratio === "2:1" && beatNumber === 2) targetIndex = 3;

        if (ui.dots[targetIndex]) ui.dots[targetIndex].classList.add('active');
    };

    const _handleSwingStart = () => {
        hidePrepOverlay(); // Interaction starts
        if (videoSyncTimeout) clearTimeout(videoSyncTimeout);

        const { rate, delay } = _calculateSyncParams(engine.bpm);

        // Reset Video
        ui.video.pause();
        ui.video.currentTime = 0;
        ui.video.playbackRate = rate;

        // Play with delay if needed
        if (delay > 0) {
            videoSyncTimeout = setTimeout(() => {
                ui.video.play().catch(_logError);
            }, delay);
        } else {
            ui.video.play().catch(_logError);
        }

        // Calculate Next Interval dynamically based on video length
        if (ui.video.duration) {
            const currentRatio = engine.ratio;
            const impactTime = IMPACT_TIMES[currentRatio] || 1.90;
            const remainingVideoTime = (ui.video.duration - impactTime);
            // Safety fallback
            const safeRemaining = (remainingVideoTime > 0) ? remainingVideoTime : 1.5;

            // Adjust for playback rate? No, usually ending is 1.0x rate after impact
            // If we don't change rate after impact, then it's 1.0.
            // Logic says: isImpact -> playbackRate = 1.0. Correct.

            engine.setIntervalDuration(safeRemaining + 3.0); // Wait video finish + 3s
        }
    };

    const _calculateSyncParams = (bpm) => {
        const beatDuration = 60 / bpm;
        const currentRatio = engine.ratio;
        const beatsToImpact = (currentRatio === "2:1") ? 2 : 3;

        const targetAudioImpactTime = beatDuration * beatsToImpact;
        const videoImpactTime = IMPACT_TIMES[currentRatio] || 1.90;

        let rate = 1.0;
        let delay = 0;

        // Visual is faster than audio? Wait (Delay)
        // Visual is slower than audio? Speed up (Rate > 1)
        if (targetAudioImpactTime >= videoImpactTime) {
            rate = 1.0;
            delay = (targetAudioImpactTime - videoImpactTime) * 1000;
        } else {
            delay = 0;
            rate = videoImpactTime / targetAudioImpactTime;
        }
        return { rate, delay };
    };

    const _triggerImpactEffects = () => {
        // Visual Flash (Red) & Shake
        if (ui.visualArea) {
            ui.visualArea.classList.add('flash-impact');
            ui.visualArea.classList.add('shake');

            setTimeout(() => {
                ui.visualArea.classList.remove('flash-impact');
                ui.visualArea.classList.remove('shake');
            }, 200);
        }

        // Count
        swingCount++;
        _updateSwingCountUI();

        // Celebration (Every 10)
        if (swingCount > 0 && swingCount % 10 === 0) {
            _showCelebration();
        }
    };

    // Redefining onBeat to handle flashes properly
    // ... wait, I should edit the 'onBeat' function itself if I want beat flashes.
    // Let's scroll up and see onBeat.

    const _showCelebration = () => {
        const el = document.createElement('div');
        el.className = 'celebration-text';
        el.textContent = `${swingCount}회 달성! 🎉`;
        ui.visualArea.appendChild(el);

        // Animation
        setTimeout(() => el.classList.add('active'), 50);
        setTimeout(() => {
            el.classList.remove('active');
            setTimeout(() => el.remove(), 500);
        }, 3000);

        // Sound
        engine.playFanfare();
    };

    const _logError = (e) => console.warn("Video Play Error (Autoplay blocked?)", e);


    // =========================================================================
    // 5. UI CONTROLLERS & EVENT HANDLERS
    // =========================================================================

    // --- Helper: Prep Overlay ---
    const showPrepOverlay = () => {
        if (!prepTextEl) {
            prepTextEl = document.createElement('div');
            prepTextEl.className = 'prep-overlay-text';
            prepTextEl.textContent = "피니쉬 유지 후 다음 샷을 준비하세요";
            ui.visualArea.appendChild(prepTextEl);
        }
        prepTextEl.classList.add('active');
    };

    const hidePrepOverlay = () => {
        if (prepTextEl) prepTextEl.classList.remove('active');
    };

    // --- Helper: Fast Click ---
    const addFastClick = (element, callback) => {
        if (!element) return;

        let isHandled = false;
        const handleEvent = (e) => {
            if (e.type === 'click' && isHandled) return;
            if (e.type === 'pointerdown') isHandled = true;
            setTimeout(() => { isHandled = false; }, 500);

            // Unlock Audio on interaction
            if (engine.audioCtx && engine.audioCtx.state === 'suspended') {
                engine.unlock();
            }
            callback(e);
        };

        if (window.PointerEvent) {
            element.addEventListener('pointerdown', handleEvent);
            element.addEventListener('click', handleEvent);
        } else {
            element.addEventListener('touchstart', handleEvent);
            element.addEventListener('click', handleEvent);
        }
    };

    // Sound Options Configuration
    const SOUND_OPTIONS = {
        "3:1": [
            { id: 'driver1', label: '파워 타이타늄' },
            { id: 'driver2', label: '모던 매트릭스' }, // Renamed from Solid Carbon
            { id: 'driver3', label: '프로 리듬' }
        ],
        "2:1": [
            { id: 'approach1', label: '크리스피 웨지' },
            { id: 'approach2', label: '퓨어 글래스' }, // Renamed from Soft Touch
            { id: 'approach3', label: '프레시전 클릭' }
        ]
    };

    // --- Mode (Ratio) Controller ---
    const setMode = (ratioButton) => {
        const ratio = ratioButton.getAttribute('data-ratio');

        // 1. Update Buttons
        ui.ratioBtns.forEach(b => b.classList.remove('active'));
        ratioButton.classList.add('active');

        // 2. Update Engine
        engine.setRatio(ratio);

        // 3. Update BPM Settings (Slider Range & Default)
        const settings = BPM_SETTINGS[ratio];
        if (settings) {
            ui.bpmSlider.min = settings.min;
            ui.bpmSlider.max = settings.max;
            _updateBPM(settings.default);
        }

        // 4. Update Video Source
        if (ui.video) {
            ui.video.src = (ratio === "2:1") ? "img/approach.mp4" : "img/driver.mp4";
            ui.video.load();
        }

        // 5. Update Visual Dots (Hide 3rd dot for 2:1)
        if (ui.dots[2]) {
            ui.dots[2].style.display = (ratio === "2:1") ? 'none' : 'block';
        }

        // 6. Update Sound Buttons based on Mode
        const options = SOUND_OPTIONS[ratio] || SOUND_OPTIONS["3:1"];
        ui.soundBtns.forEach((btn, index) => {
            if (options[index]) {
                btn.textContent = options[index].label;
                btn.setAttribute('data-sound', options[index].id);
            }
        });

        // Reset Sound Selection to First Option
        ui.soundBtns.forEach(b => b.classList.remove('active'));
        if (ui.soundBtns[0]) {
            ui.soundBtns[0].classList.add('active');
            engine.setSound(options[0].id);
        }
    };

    // --- BPM & Volume ---
    const _updateBPM = (val) => {
        let newBPM = parseInt(val);
        const min = parseInt(ui.bpmSlider.min);
        const max = parseInt(ui.bpmSlider.max);
        if (newBPM < min) newBPM = min;
        if (newBPM > max) newBPM = max;

        ui.bpmSlider.value = newBPM;
        ui.bpmDisplay.textContent = newBPM;
        engine.setBPM(newBPM);
    };

    const _updateVolume = (val) => {
        const newVol = parseInt(val);
        ui.volSlider.value = newVol;
        ui.volValue.textContent = newVol + "%";
        engine.setVolume(newVol / 100);

        // Persist Volume Setting
        try {
            localStorage.setItem('golf_volume', newVol);
        } catch (e) {
            console.warn("Storage access failed", e);
        }
    };

    // --- Start / Stop ---
    const togglePlay = () => {
        engine.unlock();

        if (engine.isPlaying) {
            // STOP
            engine.stop();
            ui.startBtn.textContent = "시작 (START)";
            ui.startBtn.classList.remove('playing');

            // Reset Video
            if (videoSyncTimeout) clearTimeout(videoSyncTimeout);
            if (ui.video) {
                ui.video.pause();
                ui.video.currentTime = 0;
            }
            ui.impactOverlay.classList.remove('active');
            hidePrepOverlay();
        } else {
            // START
            engine.start();
            // Apply current volume again to be sure
            engine.setVolume(parseInt(ui.volSlider.value) / 100);

            ui.startBtn.textContent = "중지 (STOP)";
            ui.startBtn.classList.add('playing');
            _requestWakeLock();
        }
    };

    // --- Wake Lock ---
    const _requestWakeLock = async () => {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                ui.wakeLockBtn.textContent = "💡 화면 켜짐 유지 (ON)";
                ui.wakeLockBtn.style.color = "#00f3ff";
                wakeLock.addEventListener('release', () => {
                    wakeLock = null;
                    ui.wakeLockBtn.textContent = "💡 화면 켜짐 유지 (OFF)";
                    ui.wakeLockBtn.style.color = "#fff";
                });
            } catch (e) { console.log("WakeLock Failed", e); }
        }
    };

    // =========================================================================
    // 6. EVENT BINDINGS
    // =========================================================================

    // Controls
    addFastClick(ui.startBtn, togglePlay);

    // Sliders
    ui.bpmSlider.addEventListener('input', (e) => _updateBPM(e.target.value));
    addFastClick(ui.bpmMinus, () => _updateBPM(parseInt(ui.bpmSlider.value) - 1));
    addFastClick(ui.bpmPlus, () => _updateBPM(parseInt(ui.bpmSlider.value) + 1));

    ui.volSlider.addEventListener('input', (e) => _updateVolume(e.target.value));
    addFastClick(ui.volMinus, () => _updateVolume(parseInt(ui.volSlider.value) - 5));
    addFastClick(ui.volPlus, () => _updateVolume(parseInt(ui.volSlider.value) + 5));

    // Groups
    ui.ratioBtns.forEach(btn => addFastClick(btn, () => setMode(btn)));
    ui.soundBtns.forEach(btn => addFastClick(btn, () => {
        ui.soundBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        engine.setSound(btn.getAttribute('data-sound'));
    }));

    // Settings Menu
    addFastClick(ui.settingsToggle, (e) => {
        e.stopPropagation();
        ui.settingsMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!ui.settingsMenu.contains(e.target) && e.target !== ui.settingsToggle) {
            ui.settingsMenu.classList.add('hidden');
        }
    });

    // Reset Count
    addFastClick(ui.resetCountBtn, () => {
        swingCount = 0;
        _updateSwingCountUI();
        ui.settingsMenu.classList.add('hidden');
    });
    const _updateSwingCountUI = () => {
        ui.swingCountDisplay.textContent = `연습 횟수: ${swingCount}`;
    };

    // Fullscreen
    addFastClick(ui.videoContainer, () => {
        if (!document.fullscreenElement) {
            ui.visualArea.requestFullscreen?.() || ui.visualArea.webkitRequestFullscreen?.();
        } else {
            document.exitFullscreen?.() || document.webkitExitFullscreen?.();
        }
    });

    // Video Ended (Show Prep Text)
    if (ui.video) {
        ui.video.removeAttribute('loop');
        ui.video.addEventListener('ended', () => {
            if (engine.isPlaying) showPrepOverlay();
        });
    }

    // Help Modal Logic
    ui.helpIcons.forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = icon.getAttribute('data-help');

            if (key === 'bpm') {
                const isDriver = (engine.ratio === "3:1");
                if (isDriver) {
                    ui.modalTitle.textContent = "🏌️‍♂️ 드라이버 모드";
                    ui.modalText.innerHTML = `드라이버는 충분한 회전과 비거리를 위해 리드미컬하고 탄력 있는 템포가 필요합니다.<br><br><strong>• 부드럽게 (140 BPM)</strong><br>여유로운 리듬으로 정타율을 높이고 싶은 아마추어 및 시니어 골퍼용<br><br><strong>• 표준 (160 BPM)</strong><br>비거리와 일관성의 균형을 잡아주는 아마추어 남성 및 여성 프로 표준 템포<br><br><strong>• 프로 (185 BPM)</strong><br>강력한 지면 반발력과 빠른 근전환을 사용하는 투어 프로의 폭발적인 리듬`;
                } else {
                    ui.modalTitle.textContent = "⛳ 어프로치 모드";
                    ui.modalText.innerHTML = `어프로치는 스윙 크기가 작고 간결해야 하며, 정확한 터치와 거리감을 위해 드라이버보다 약간 차분한 템포를 권장합니다.<br><br><strong>• 부드럽게 (115 BPM)</strong><br>섬세한 거리 조절이 필요한 숏게임에서 심리적 여유를 주는 여유로운 리듬<br><br><strong>• 표준 (135 BPM)</strong><br>간결한 백스윙과 일관된 임팩트 타이밍을 만들어주는 상급 아마추어 표준 리듬<br><br><strong>• 프로 (155 BPM)</strong><br>백스윙을 최소화하고 즉각적인 가속으로 스핀량을 극대화하는 투어 프로용 템포`;
                }
            } else if (HELP_DATA[key]) {
                ui.modalTitle.textContent = HELP_DATA[key].title;
                ui.modalText.innerHTML = HELP_DATA[key].text.replace(/\n/g, '<br>');
            }
            ui.helpModal.classList.remove('hidden');
        });
    });
    ui.closeModal.addEventListener('click', () => ui.helpModal.classList.add('hidden'));

    // =========================================================================
    // 7. INITIALIZATION BOOTSTRAP
    // =========================================================================

    // Force Driver Mode (3:1) on Load & Load Volume
    setTimeout(() => {
        // Load Saved Volume
        try {
            const savedVol = localStorage.getItem('golf_volume');
            if (savedVol !== null) {
                _updateVolume(savedVol);
                console.log("Volume Loaded:", savedVol);
            }
        } catch (e) { console.warn("Load volume failed", e); }

        // Find 3:1 button
        const driverBtn = document.querySelector('.toggle-btn[data-ratio="3:1"]');
        if (driverBtn) setMode(driverBtn);
        console.log("App Initialized. Mode: Driver (3:1)");
    }, 50);

});
