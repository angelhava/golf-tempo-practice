document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. CONSTANTS & DOM ELEMENTS
    // =========================================================================
    const BPM_SETTINGS = {
        "3:1": { min: 70, max: 170, default: 125, baseBPM: 145 },
        "2:1": { min: 70, max: 170, default: 85, baseBPM: 125 }
    };

    const VIDEO_IMPACT_TIMES = {
        "3:1": 1.16, // Measured impact time for driver.mp4
        "2:1": 0.96  // Corrected impact time for approach.mp4
    };

    const HELP_CONTENT = {
        bpm: {
            title: "템포 (BPM)란?",
            text: "BPM은 분당 비트 수(Beats Per Minute)를 의미하며, 스윙의 빠르기를 조절합니다. 숫자가 높을수록 템포가 빨라집니다. 자신에게 맞는 템포를 찾아 연습해보세요."
        },
        driver_bpm: {
            title: "드라이버 권장 템포",
            html: `
                <p>BPM은 분당 비트 수(Beats Per Minute)를 의미하며, 스윙의 빠르기를 조절합니다. 숫자가 높을수록 템포가 빨라집니다. 자신에게 맞는 템포를 찾아 연습해보세요.</p>
                <br>
                <table>
                    <tbody>
                        <tr><td>여성/주니어</td><td>100 BPM</td></tr>
                        <tr class="recommended"><td>일반 남성 표준</td><td>120 BPM</td></tr>
                        <tr><td>타이거 우즈 모드</td><td>144 BPM</td></tr>
                        <tr><td>로리 맥길로이 모드</td><td>156 BPM</td></tr>
                        <tr><td>초고속 장타 모드</td><td>180 BPM</td></tr>
                    </tbody>
                </table>
            `
        },
        approach_bpm: {
            title: "어프로치 권장 템포",
            html: `
                <p>BPM은 분당 비트 수(Beats Per Minute)를 의미하며, 스윙의 빠르기를 조절합니다. 숫자가 높을수록 템포가 빨라집니다. 자신에게 맞는 템포를 찾아 연습해보세요.</p>
                <br>
                <table>
                    <tbody>
                        <tr><td>퍼팅/칩샷</td><td>80 BPM</td></tr>
                        <tr><td>소프트 어프로치</td><td>90 BPM</td></tr>
                        <tr class="recommended"><td>로리 어프로치 (정석)</td><td>95 BPM</td></tr>
                        <tr><td>프로 웨지 샷</td><td>110 BPM</td></tr>
                        <tr><td>공격적 어프로치</td><td>120 BPM</td></tr>
                    </tbody>
                </table>
            `
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
        neonBpmDisplay: document.getElementById('neon-bpm-value'), // Added neon display
        volSlider: document.getElementById('volume-slider'),
        volMinus: document.getElementById('vol-minus'),
        volPlus: document.getElementById('vol-plus'),
        volumeDisplay: document.getElementById('volume-value-display'),
        video: document.getElementById('swing-video'),
        dots: Array.from(document.querySelectorAll('.beat-dots .dot')),
        swingCountDisplay: document.getElementById('swing-count-display'),
        ratioBtns: document.querySelectorAll('.toggle-btn[data-ratio]'),
        soundBtns: document.querySelectorAll('.toggle-btn[data-sound]'),
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
    
    let state = {
        appStatus: 'idle', 
        swingCount: 0,
        isFirstPlay: true,
        wakeLock: null,
        countdownTimer: null,
        videoSyncTimeout: null, 
        bpmValueTimeout: null, 
        volumeValueTimeout: null
    };

    const onBeat = (beatNumber, isImpact) => {
        if (beatNumber === 0 && ui.video && state.appStatus === 'playing') {
            const ratio = engine.ratio;
            const bpm = engine.bpm;
            const videoImpactTime = VIDEO_IMPACT_TIMES[ratio];
            const playbackRate = ui.video.playbackRate;
            const timeToImpactVideo = videoImpactTime / playbackRate;
            const beatsToImpact = (ratio === "3:1") ? 3 : 2;
            const secondsPerBeat = 60.0 / bpm;
            const timeToImpactAudio = beatsToImpact * secondsPerBeat;
            const timeDifference = timeToImpactVideo - timeToImpactAudio;

            if (state.videoSyncTimeout) clearTimeout(state.videoSyncTimeout);

            if (timeDifference >= 0) {
                ui.video.currentTime = 0;
                state.videoSyncTimeout = setTimeout(() => {
                    if(state.appStatus === 'playing') {
                        const playPromise = ui.video.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(error => console.warn("Video play failed (delayed):", error));
                        }
                    }
                }, timeDifference * 1000);
            } else {
                ui.video.currentTime = -timeDifference;
                const playPromise = ui.video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => console.warn("Video play failed (seeked):", error));
                }
            }
        }

        _updateVisualDots(beatNumber, isImpact);
        _triggerNeonFlash(isImpact);
        if (isImpact) _triggerImpactEffects();
    };

    const engine = new TempoEngine(onBeat);
    
    const _startCountdown = () => {
        state.appStatus = 'countdown';
        ui.statusText.textContent = "준비";
        ui.countdownText.textContent = "";
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
        state.appStatus = 'playing';
        ui.statusOverlay.classList.remove('visible');
        engine.start();
    };
    
    const _stopEverything = () => {
        state.appStatus = 'idle';
        if (state.countdownTimer) {
            clearTimeout(state.countdownTimer);
            state.countdownTimer = null;
        }

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
        
        if (!ui.startBtn.disabled) {
            ui.startBtn.textContent = "시작";
        }
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
        void overlay.offsetWidth; 
        requestAnimationFrame(() => {
            overlay.classList.add(isImpact ? 'impact' : 'beat');
        });
    };

    const _updateVisualDots = (beatNumber, isImpact = false) => {
        requestAnimationFrame(() => {
            ui.dots.forEach(d => d.classList.remove('active', 'impact'));
            if (beatNumber < 0) return;
            
            let targetIndex = beatNumber;
            if (engine.ratio === "2:1" && beatNumber === 2) {
                targetIndex = 3; 
            }

            if (ui.dots[targetIndex]) {
                ui.dots[targetIndex].classList.add('active');
                if (isImpact) {
                    ui.dots[targetIndex].classList.add('impact');
                }
            }
        });
    };
    
    const togglePlay = () => {
        if (ui.startBtn.disabled) return; 

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
        
        const newRatio = ratioButton.dataset.ratio;
        engine.setRatio(newRatio);
        ui.ratioBtns.forEach(b => b.classList.remove('active'));
        ratioButton.classList.add('active');
        
        const settings = BPM_SETTINGS[newRatio];
        if (settings) {
            ui.bpmSlider.min = settings.min;
            ui.bpmSlider.max = settings.max;
            updateBPM(settings.default, true);
        }
        
        const isDriver = newRatio === "3:1";
        const newVideoSrc = isDriver ? "img/driver.mp4" : "img/approach.mp4";

        if (ui.video && (!ui.video.currentSrc || !ui.video.currentSrc.includes(newVideoSrc))) {
            ui.startBtn.disabled = true;
            ui.startBtn.textContent = "영상 로딩중...";
            ui.video.src = newVideoSrc;
            ui.video.load(); 
        } else {
            ui.startBtn.disabled = false;
            ui.startBtn.textContent = "시작";
        }
        
        if (ui.dots[2]) ui.dots[2].style.display = isDriver ? 'block' : 'none';

        updateSoundAndVideo();
    };

    const updateSoundAndVideo = () => {
        const isDriver = engine.ratio === '3:1';
        let activeSoundBtn = document.querySelector('.toggle-btn[data-sound].active');

        let activeIndex = 0;
        ui.soundBtns.forEach((btn, i) => {
            if (btn === activeSoundBtn) {
                activeIndex = i;
            }
        });
        
        const soundIds = isDriver ? ['driver1', 'driver2', 'driver3'] : ['approach1', 'approach2', 'approach3'];

        ui.soundBtns.forEach((btn, i) => {
            btn.dataset.sound = soundIds[i];
            btn.classList.toggle('active', i === activeIndex);
        });

        engine.setSound(soundIds[activeIndex]);
    };

    const updateBPM = (val, showImmediately = true) => {
        const newBPM = Math.max(parseInt(ui.bpmSlider.min), Math.min(parseInt(ui.bpmSlider.max), parseInt(val)));
        ui.bpmSlider.value = newBPM;
        if (ui.bpmDisplay) {
            ui.bpmDisplay.textContent = newBPM;
            if (showImmediately) {
                ui.bpmDisplay.classList.add('visible');
                if (state.bpmValueTimeout) clearTimeout(state.bpmValueTimeout);
                state.bpmValueTimeout = setTimeout(() => {
                    ui.bpmDisplay.classList.remove('visible');
                }, 1000);
            }
        }
        if (ui.neonBpmDisplay) { // Update neon display
            ui.neonBpmDisplay.textContent = newBPM;
        }
        engine.setBPM(newBPM);

        // --- [FIXED] Playback Rate Auto-Sync --- 
        if (ui.video) {
            const ratio = engine.ratio;
            const videoFileImpactTime = VIDEO_IMPACT_TIMES[ratio];

            const beatsToImpact = (ratio === "3:1") ? 3 : 2;
            const secondsPerBeat = 60.0 / newBPM;
            const timeToImpactAudio = beatsToImpact * secondsPerBeat;

            const newPlaybackRate = videoFileImpactTime / timeToImpactAudio;

            ui.video.playbackRate = newPlaybackRate;
        }
    };

    const updateVolume = (val, showImmediately = true) => {
        const newVol = Math.max(0, Math.min(100, parseInt(val)));
        ui.volSlider.value = newVol;
        if (ui.volumeDisplay) {
            ui.volumeDisplay.textContent = newVol;
            if (showImmediately) {
                ui.volumeDisplay.classList.add('visible');
                if (state.volumeValueTimeout) clearTimeout(state.volumeValueTimeout);
                state.volumeValueTimeout = setTimeout(() => {
                    ui.volumeDisplay.classList.remove('visible');
                }, 1000);
            }
        }
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
            contentTopic = engine.ratio === '3:1' ? 'driver' : 'approach';
        } else if (topic === 'bpm') {
            contentTopic = engine.ratio === '3:1' ? 'driver_bpm' : 'approach_bpm';
        }

        const content = HELP_CONTENT[contentTopic];
        if (!content || !ui.helpModal) return;

        ui.helpModalTitle.textContent = content.title;
        
        if (content.html) {
            ui.helpModalText.innerHTML = content.html;
        } else {
            ui.helpModalText.innerHTML = '';
            ui.helpModalText.textContent = content.text;
        }
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
        _startCountdown();
    };

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
        addFastClick(ui.volMinus, () => updateVolume(parseInt(ui.volSlider.value) - 5, true));
        addFastClick(ui.volPlus, () => updateVolume(parseInt(ui.volSlider.value) + 5, true));
        if (ui.volSlider) ui.volSlider.addEventListener('input', (e) => updateVolume(e.target.value, true));
        addFastClick(ui.bpmMinus, () => updateBPM(parseInt(ui.bpmSlider.value) - 1, true));
        addFastClick(ui.bpmPlus, () => updateBPM(parseInt(ui.bpmSlider.value) + 1, true));
        if (ui.bpmSlider) ui.bpmSlider.addEventListener('input', (e) => updateBPM(e.target.value, true));
        
        ui.ratioBtns.forEach(btn => addFastClick(btn, () => setMode(btn)));
        
        ui.soundBtns.forEach(btn => {
            addFastClick(btn, () => {
                if (state.isFirstPlay) engine.unlock();
                if (btn.classList.contains('active')) return;

                if (state.appStatus !== 'idle') {
                    _stopEverything();
                }

                ui.soundBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                engine.setSound(btn.dataset.sound);
            });
        });
        
        addFastClick(ui.settingsToggle, () => ui.settingsMenu && ui.settingsMenu.classList.remove('hidden'));
        addFastClick(ui.closeSettingsBtn, () => ui.settingsMenu && ui.settingsMenu.classList.add('hidden'));
        addFastClick(ui.wakeLockBtn, toggleWakeLock);
        if (ui.video) {
            ui.video.addEventListener('ended', onVideoEnd);

            const onVideoReady = () => {
                ui.startBtn.disabled = false;
                ui.startBtn.textContent = "시작";
                console.log(`Video for ${engine.ratio} mode is ready to play.`);
            };
            ui.video.addEventListener('canplay', onVideoReady);
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
        addFastClick(ui.helpModal, (e) => {
            if (e.target === ui.helpModal) closeHelpModal();
        });
    }

    function initializeApp() {
        if (ui.video) {
            ui.video.muted = true;
            ui.video.playsInline = true;
        }
        try {
            const savedVol = localStorage.getItem('golf_volume');
            updateVolume(savedVol !== null ? savedVol : 100, false);
        } catch (e) {
            updateVolume(100, false);
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
