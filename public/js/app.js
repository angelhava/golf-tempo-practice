
document.addEventListener('DOMContentLoaded', () => {
    const BPM_SETTINGS = {
        "3:1": { min: 70, max: 210, default: 207, baseBPM: 207 },
        "2:1": { min: 70, max: 170, default: 118, baseBPM: 118 }
    };

    const SOUND_MAP = {
        "3:1": { beep: 'driver1', whistle: 'driver2', metronome: 'driver3' },
        "2:1": { beep: 'approach1', whistle: 'approach2', metronome: 'approach3' }
    };

    const VIDEO_IMPACT_TIMINGS = {
        "3:1": 0.87, // Driver impact time
        "2:1": 1.02  // Approach impact time
    };
    
    const PRELOAD_RESOURCES = [
        'img/driver_optimized.mp4',
        'img/approach_optimized.mp4'
    ];

    const HELP_CONTENT = {
        bpm: { 
            title: "템포(BPM) 가이드", 
            text: `BPM(분당 비트 수)은 스윙의 전체적인 빠르기를 결정합니다.\n\n<드라이버 모드 추천>\n- 남성 아마추어: 90-110 BPM\n- 여성 아마추어: 80-100 BPM\n\n<어프로치 모드 추천>\n- 공통: 80-100 BPM\n\n본 앱의 기준 템포(드라이버 207, 어프로치 118)는 로리 맥길로이의 실제 스윙 데이터를 기반으로 설정되었습니다. 자신에게 맞는 템포를 찾아보세요.`
        },
        ratio: { 
            title: "스윙 비율이란?", 
            text: "스윙 비율은 백스윙과 다운스윙의 시간 비율을 의미합니다. 3:1은 드라이버, 2:1은 어프로치에 이상적인 리듬으로 알려져 있습니다."
        }
    };

    const ui = {
        appContainer: document.querySelector('.app-container'),
        startBtn: document.getElementById('start-btn'),
        mainControls: document.getElementById('main-controls'),
        bpmSlider: document.getElementById('bpm-slider'),
        bpmDisplay: document.getElementById('bpm-value-display'),
        neonBpmDisplay: document.getElementById('neon-bpm-value'),
        bpmMinusBtn: document.getElementById('bpm-minus'),
        bpmPlusBtn: document.getElementById('bpm-plus'),
        volSlider: document.getElementById('volume-slider'),
        volumeDisplay: document.getElementById('volume-value-display'),
        volMinusBtn: document.getElementById('vol-minus'),
        volPlusBtn: document.getElementById('vol-plus'),
        ratioBtns: document.querySelectorAll('.toggle-btn[data-ratio]'),
        soundBtns: document.querySelectorAll('.toggle-btn[data-sound]'),
        video: document.getElementById('swing-video'),
        visualContainer: document.querySelector('.visual-container'),
        dots: Array.from(document.querySelectorAll('.beat-dots .dot')),
        swingCountDisplay: document.getElementById('swing-count-display'),
        statusOverlay: document.getElementById('status-overlay'),
        statusText: document.getElementById('status-text'),
        countdownText: document.getElementById('countdown-text'),
        neonOverlay: document.getElementById('neon-overlay'),
        settingsToggle: document.getElementById('settings-toggle'),
        settingsPanel: document.getElementById('settings-panel'),
        closeSettingsBtn: document.getElementById('close-settings-btn'),
        wakeLockBtn: document.getElementById('wake-lock-btn'),
        helpBtns: document.querySelectorAll('.help-btn'),
        helpModal: document.getElementById('help-modal'),
        helpModalTitle: document.getElementById('help-modal-title'),
        helpModalText: document.getElementById('help-modal-text'),
        closeHelpModalBtn: document.getElementById('close-help-modal-btn'),
    };
    
    let state = {
        appStatus: 'idle',
        swingCount: 0,
        isFirstPlay: true,
        wakeLock: null,
        countdownTimer: null,
        videoStartTimer: null, 
        valueTimeout: null,
        nextBPM: null,
        userVideoSyncOffset: 0, // Kept for timing calculation, but not user-adjustable
        resourceCache: {}
    };
    
    const calculateVideoStartTime = () => {
        const ratio = engine.ratio;
        const bpm = engine.bpm;
        const playbackRate = ui.video.playbackRate || 1;
        
        const beatInterval = 60 / bpm;
        const impactBeatIndex = (ratio === "3:1") ? 3 : 2; 
        const audioImpactTime = beatInterval * impactBeatIndex;
        
        const videoImpactTime = VIDEO_IMPACT_TIMINGS[ratio] / playbackRate;
        
        const baseStartTime = videoImpactTime - audioImpactTime;
        return baseStartTime + state.userVideoSyncOffset; 
    };

    const onBeat = (beatNumber, isImpact) => {
        _updateVisualDots(beatNumber, isImpact);
        _triggerNeonFlash(isImpact);
        if (isImpact) {
            state.swingCount++;
            _updateSwingCountUI();
        }
    };

    const engine = new TempoEngine(onBeat);

    const _startCountdown = () => {
        if (state.nextBPM !== null) { _applyBPM(state.nextBPM); state.nextBPM = null; }
        state.appStatus = 'countdown';
        
        const beatInterval = 60000 / engine.bpm;

        ui.statusText.textContent = "준비";
        ui.countdownText.textContent = "";
        ui.statusOverlay.classList.add('visible');
        clearTimeout(state.countdownTimer);

        state.countdownTimer = setTimeout(() => {
            if (state.appStatus !== 'countdown') return;
            ui.statusText.textContent = "Go!";
            ui.countdownText.textContent = "";
            
            state.countdownTimer = setTimeout(() => {
                if (state.appStatus !== 'countdown') return;
                _startTempo();
            }, beatInterval);
        }, beatInterval);
    };

    const _startTempo = () => {
        state.appStatus = 'playing';
        ui.statusOverlay.classList.remove('visible');
        const video = ui.video;

        const onCanPlayThrough = () => {
            const calculatedStartTime = calculateVideoStartTime();
            if (calculatedStartTime >= 0) {
                video.currentTime = calculatedStartTime;
            } else {
                video.currentTime = 0;
                const delay = -calculatedStartTime * 1000;
                clearTimeout(state.videoStartTimer);
                state.videoStartTimer = setTimeout(() => {
                    // No need to call play() again if it's already playing
                }, delay);
            }
        };
        video.addEventListener('canplaythrough', onCanPlayThrough, { once: true });

        engine.start();
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn("Video play failed initially:", error);
                _stopEverything();
            });
        }
    };
    
    const _stopEverything = () => {
        state.appStatus = 'idle';
        clearTimeout(state.countdownTimer);
        clearTimeout(state.videoStartTimer); 
        engine.stop();
        if (ui.video) { 
            ui.video.pause(); 
        }
        ui.neonOverlay.classList.remove('beat', 'impact');
        if (ui.startBtn) {
            ui.startBtn.textContent = "시작";
            ui.startBtn.classList.remove('playing');
        }
        ui.appContainer.classList.remove('is-playing');
        ui.statusOverlay.classList.remove('visible');
        _updateVisualDots(-1);
    };

    const _triggerNeonFlash = (isImpact) => {
        ui.neonOverlay.classList.remove('beat', 'impact');
        void ui.neonOverlay.offsetWidth;
        requestAnimationFrame(() => { ui.neonOverlay.classList.add(isImpact ? 'impact' : 'beat'); });
    };

    const _updateVisualDots = (beatNumber, isImpact = false) => {
        ui.dots.forEach(d => d.classList.remove('active', 'impact'));
        if (beatNumber < 0) return;
        const targetIndex = (engine.ratio === "2:1" && beatNumber === 2) ? 3 : beatNumber;
        if (ui.dots[targetIndex]) {
            ui.dots[targetIndex].classList.add('active');
            if (isImpact) ui.dots[targetIndex].classList.add('impact');
        }
    };
    
    const togglePlay = () => {
        if (ui.startBtn && ui.startBtn.disabled) return;
        if (state.isFirstPlay) { 
            engine.unlock(); 
            state.isFirstPlay = false; 
        }
        if (state.appStatus === 'idle') {
            _startCountdown();
            if (ui.startBtn) {
                ui.startBtn.textContent = "중지";
                ui.startBtn.classList.add('playing');
            }
            ui.appContainer.classList.add('is-playing');
        } else {
            _stopEverything();
        }
    };

    const setMode = (ratioButton) => {
        if (state.appStatus !== 'idle') _stopEverything();
        state.nextBPM = null; 
        const newRatio = ratioButton.dataset.ratio;
        engine.setRatio(newRatio);
        ui.ratioBtns.forEach(b => b.classList.remove('active'));
        ratioButton.classList.add('active');
        const settings = BPM_SETTINGS[newRatio];
        ui.bpmSlider.min = settings.min;
        ui.bpmSlider.max = settings.max;
        updateBPM(settings.default, true);
        
        const newVideoSrc = (newRatio === "3:1") ? 'img/driver_optimized.mp4' : 'img/approach_optimized.mp4';
        const videoURL = state.resourceCache[newVideoSrc];

        if (ui.video && videoURL && ui.video.src !== videoURL) {
            ui.video.src = videoURL;
            ui.video.load();
        }

        ui.dots[2].style.display = (newRatio === "3:1") ? 'block' : 'none';
        const activeSoundBtn = document.querySelector('.toggle-btn[data-sound].active');
        if (activeSoundBtn) setSound(activeSoundBtn, true);
    };

    const setSound = (soundButton, forceUpdate = false) => {
        if (!soundButton || (!forceUpdate && soundButton.classList.contains('active'))) return;
        if (state.isFirstPlay) engine.unlock();
        if (state.appStatus !== 'idle') _stopEverything();
        ui.soundBtns.forEach(b => b.classList.remove('active'));
        soundButton.classList.add('active');
        const soundType = soundButton.dataset.sound;
        const ratio = engine.ratio;
        const soundId = SOUND_MAP[ratio][soundType];
        if(soundId) engine.setSound(soundId);
        try { localStorage.setItem('golf_sound_type', soundType); } catch (e) { console.warn("Could not save sound type.", e); }
    };

    const _applyBPM = (bpm) => {
        engine.setBPM(bpm);
        if (ui.video) {
            const ratio = engine.ratio;
            const baseBPM = BPM_SETTINGS[ratio].baseBPM;
            const newPlaybackRate = bpm / baseBPM;
            ui.video.playbackRate = newPlaybackRate;
        }
    };

    const updateBPM = (val, showImmediately = false) => {
        const newBPM = Math.max(parseInt(ui.bpmSlider.min), Math.min(parseInt(ui.bpmSlider.max), parseInt(val)));
        ui.bpmSlider.value = newBPM;
        ui.bpmDisplay.textContent = newBPM;
        ui.neonBpmDisplay.textContent = newBPM;
        if (showImmediately) {
            ui.bpmDisplay.classList.add('visible');
            clearTimeout(state.valueTimeout);
            state.valueTimeout = setTimeout(() => ui.bpmDisplay.classList.remove('visible'), 1000);
        }
        if (state.appStatus === 'playing' || state.appStatus === 'countdown') {
            state.nextBPM = newBPM;
        } else {
            _applyBPM(newBPM);
            state.nextBPM = null;
        }
    };

    const updateVolume = (val, showImmediately = false) => {
        const newVol = Math.max(0, Math.min(100, parseInt(val)));
        ui.volSlider.value = newVol;
        ui.volumeDisplay.textContent = newVol;
        engine.setVolume(newVol / 100);
        try { localStorage.setItem('golf_volume', newVol); } catch (e) { console.warn("Could not save volume.", e); }
        if (showImmediately) {
            ui.volumeDisplay.classList.add('visible');
            clearTimeout(state.valueTimeout);
            state.valueTimeout = setTimeout(() => ui.volumeDisplay.classList.remove('visible'), 1000);
        }
    };

    const openSettingsPanel = () => {
        if (state.appStatus !== 'idle') {
            _stopEverything();
        }
        ui.mainControls.classList.add('hidden');
        ui.settingsPanel.classList.remove('hidden');
        ui.visualContainer.style.display = 'none';
    };

    const closeSettingsPanel = () => {
        ui.settingsPanel.classList.add('hidden');
        ui.mainControls.classList.remove('hidden');
        ui.visualContainer.style.display = 'flex';
    };

    const showHelpModal = (type) => {
        const content = HELP_CONTENT[type];
        if (!content) return;
        if (state.appStatus !== 'idle') {
            _stopEverything();
        }
        ui.helpModalTitle.textContent = content.title;
        ui.helpModalText.innerHTML = content.text;
        ui.helpModal.classList.remove('hidden');
    };

    const _updateSwingCountUI = () => { ui.swingCountDisplay.textContent = `연습 횟수: ${state.swingCount}`; };
    
    const onVideoEnd = () => {
        if (state.appStatus !== 'playing') return;
        _stopEverything(); 
        setTimeout(() => {
            if(state.appStatus === 'idle') { 
                togglePlay();
            }
        }, 50);
    };

    const toggleWakeLock = async () => {
        try {
            if (state.wakeLock) {
                await state.wakeLock.release();
                state.wakeLock = null;
            } else {
                state.wakeLock = await navigator.wakeLock.request('screen');
                state.wakeLock.addEventListener('release', () => { state.wakeLock = null; _updateWakeLockUI(false); });
            }
        } catch (err) { console.error('Wake Lock failed:', err); state.wakeLock = null; }
        _updateWakeLockUI(state.wakeLock !== null);
    };
    
    const _updateWakeLockUI = (isActive) => {
         if (isActive) {
            ui.wakeLockBtn.textContent = "화면 자동 꺼짐 방지: ON";
            ui.wakeLockBtn.classList.add('active');
         } else {
            ui.wakeLockBtn.textContent = "화면 자동 꺼짐 방지: OFF";
            ui.wakeLockBtn.classList.remove('active');
         }
    };

    function bindEvents() {
        if (ui.startBtn) {
            ui.startBtn.addEventListener('click', togglePlay);
        }
        
        ui.volSlider.addEventListener('input', (e) => updateVolume(e.target.value, true));
        ui.volMinusBtn.addEventListener('click', () => updateVolume(parseInt(ui.volSlider.value) - 1, true));
        ui.volPlusBtn.addEventListener('click', () => updateVolume(parseInt(ui.volSlider.value) + 1, true));

        ui.bpmSlider.addEventListener('input', (e) => updateBPM(e.target.value, true));
        ui.bpmMinusBtn.addEventListener('click', () => updateBPM(parseInt(ui.bpmSlider.value) - 1, true));
        ui.bpmPlusBtn.addEventListener('click', () => updateBPM(parseInt(ui.bpmSlider.value) + 1, true));

        ui.ratioBtns.forEach(btn => btn.addEventListener('click', () => setMode(btn)));
        ui.soundBtns.forEach(btn => btn.addEventListener('click', () => setSound(btn)));
        
        ui.video.addEventListener('ended', onVideoEnd);
        
        ui.settingsToggle.addEventListener('click', openSettingsPanel);
        ui.closeSettingsBtn.addEventListener('click', closeSettingsPanel);

        ui.wakeLockBtn.addEventListener('click', toggleWakeLock);
        ui.helpBtns.forEach(btn => btn.addEventListener('click', (e) => showHelpModal(e.target.dataset.help)));
        ui.closeHelpModalBtn.addEventListener('click', () => ui.helpModal.classList.add('hidden'));
    }

    async function preloadResources() {
        if (!ui.startBtn) return;
        let loadedCount = 0;
        const totalCount = PRELOAD_RESOURCES.length;

        ui.startBtn.disabled = true;
        ui.startBtn.textContent = `로딩중... (0/${totalCount})`;

        const promises = PRELOAD_RESOURCES.map(async (src) => {
            try {
                const response = await fetch(src);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                state.resourceCache[src] = url;
            } catch (error) {
                console.error(`Failed to preload resource: ${src}`, error);
            } finally {
                loadedCount++;
                ui.startBtn.textContent = `로딩중... (${loadedCount}/${totalCount})`;
            }
        });

        await Promise.all(promises);

        ui.startBtn.disabled = false;
        ui.startBtn.textContent = "시작";
    }


    async function initializeApp() {
        bindEvents();
        await preloadResources();

        let savedVol = 100, savedSoundType = 'metronome';
        try {
            const vol = localStorage.getItem('golf_volume');
            const sound = localStorage.getItem('golf_sound_type');

            if (vol !== null) savedVol = parseInt(vol, 10);
            if (sound !== null) savedSoundType = sound;

        } catch (e) { 
            console.warn("LocalStorage is not available. Using default settings.");
        }

        updateVolume(savedVol);

        const initialSoundBtn = document.querySelector(`.toggle-btn[data-sound='${savedSoundType}']`);
        if (initialSoundBtn) setSound(initialSoundBtn, true);
        
        const initialModeBtn = document.querySelector('.toggle-btn[data-ratio="3:1"]');
        if (initialModeBtn) setMode(initialModeBtn);

        _updateSwingCountUI();
        _updateWakeLockUI(false);
        closeSettingsPanel();
        
        console.log("App Initialized.");
    }

    initializeApp();
});
