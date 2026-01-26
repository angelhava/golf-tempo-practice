document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const startBtn = document.getElementById('start-btn');
    const visualArea = document.getElementById('visual-area');
    const dots = [
        document.getElementById('beat-dot-1'),
        document.getElementById('beat-dot-2'),
        document.getElementById('beat-dot-3'),
        document.getElementById('beat-dot-4')
    ];

    // BPM & Volume
    const bpmSlider = document.getElementById('bpm-slider');
    const bpmMinusBtn = document.getElementById('bpm-minus');
    const bpmPlusBtn = document.getElementById('bpm-plus');
    const neonBpmValue = document.getElementById('neon-bpm-value');

    const volumeSlider = document.getElementById('volume-slider');
    const volumeValue = document.getElementById('volume-value');
    const volMinusBtn = document.getElementById('vol-minus');
    const volPlusBtn = document.getElementById('vol-plus');

    // Visuals
    const swingVideo = document.getElementById('swing-video');
    const videoContainer = document.getElementById('video-container'); // For Fullscreen
    const impactOverlay = document.querySelector('.impact-overlay');

    // Settings & Menu
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsMenu = document.getElementById('settings-menu');
    const wakeLockBtn = document.getElementById('wake-lock-btn');
    const resetCountBtn = document.getElementById('reset-count-btn');
    const swingCountDisplay = document.getElementById('swing-count-display');

    // Selecting Groups
    const ratioBtns = document.querySelectorAll('.toggle-btn[data-ratio]');
    const soundBtns = document.querySelectorAll('.toggle-btn[data-sound]');

    // Help Modal
    const helpIcons = document.querySelectorAll('.help-icon');
    const helpModal = document.getElementById('help-modal');
    const closeModal = document.getElementById('close-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');

    // --- State ---
    let swingCount = 0;
    let wakeLock = null;
    const IMPACT_POINT_SEC = 2.17; // Impact time in seconds

    // --- Helpers ---
    const calculatePlaybackRate = (bpm) => {
        // Formula: PlaybackRate = ImpactTime / (BeatsToImpact * SecondsPerBeat)
        const beatDuration = 60 / bpm;
        // 3:1 -> 3 beats to impact. 2:1 -> 2 beats to impact.
        const beatsToImpact = (engine && engine.ratio === "2:1") ? 2 : 3;
        const targetImpactDuration = beatDuration * beatsToImpact;
        return IMPACT_POINT_SEC / targetImpactDuration;
    };

    // --- Audio Engine Setup ---
    const onBeat = (beatNumber, isImpact) => {
        // 1. Visual Dots Update
        dots.forEach(d => d.classList.remove('active'));

        let targetDotIndex = beatNumber;
        if (engine.ratio === "2:1" && beatNumber === 2) targetDotIndex = 3;

        if (dots[targetDotIndex]) {
            dots[targetDotIndex].classList.add('active');
        }

        // 2. Video Sync Logic
        if (swingVideo) {
            if (beatNumber === 0) {
                // START SWING (Beat 1)
                const rate = calculatePlaybackRate(engine.bpm);
                swingVideo.currentTime = 0;
                swingVideo.playbackRate = rate;
                swingVideo.play().catch(e => console.log(e));
            }
            else if (isImpact) {
                // IMPACT (Beat 4)
                swingVideo.playbackRate = 1.0;
            }
        }

        // 3. Visual Feedback (Impact Flash & Shake)
        if (isImpact) {
            impactOverlay.classList.add('active');
            visualArea.classList.add('shake'); // Shake effect
            setTimeout(() => {
                impactOverlay.classList.remove('active');
                visualArea.classList.remove('shake');
            }, 200);

            // Count Update & Celebration
            swingCount++;
            updateSwingCount();

            // Celebration every 10 swings
            if (swingCount > 0 && swingCount % 10 === 0) {
                triggerCelebration();
            }
        }
    };

    const triggerCelebration = () => {
        // Visual
        const celText = document.createElement('div');
        celText.className = 'celebration-text';
        celText.textContent = `${swingCount}회 달성! 🎉`;
        visualArea.appendChild(celText);

        setTimeout(() => celText.classList.add('active'), 50);
        setTimeout(() => {
            celText.classList.remove('active');
            setTimeout(() => celText.remove(), 500);
        }, 2000);

        // Sound (Fanfare)
        engine.playFanfare();
    };

    // Add Fanfare to Engine
    TempoEngine.prototype.playFanfare = function () {
        const now = this.audioCtx.currentTime;
        // Simple C-E-G-C Arpeggio
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
    };

    const engine = new TempoEngine(onBeat);

    // --- Setup & Initialization ---
    // User requested default BPM 75
    engine.setBPM(75);

    // --- Helper: Fast Touch Action ---
    // Supports both 'click' and 'pointerdown' for immediate response
    const addFastClick = (element, callback) => {
        let isHandled = false;

        const handleEvent = (e) => {
            // Prevent double firing (pointerdown then click)
            if (e.type === 'click' && isHandled) return;
            if (e.type === 'pointerdown') isHandled = true;

            // Reset flag after a short delay
            setTimeout(() => { isHandled = false; }, 500);

            // Unlock Audio on first interaction (Mobile policy)
            if (engine && engine.audioCtx && engine.audioCtx.state === 'suspended') {
                engine.unlock();
            }

            callback(e);
        };

        // Use pointerdown for immediate feel, fallback to click
        if (window.PointerEvent) {
            element.addEventListener('pointerdown', handleEvent);
            element.addEventListener('click', handleEvent); // Backup
        } else {
            element.addEventListener('touchstart', handleEvent); // Old mobile
            element.addEventListener('click', handleEvent);
        }
    };

    // --- Audio Engine Setup ---
    // (Previous engine setup code remains, simplified here for context)
    // ...

    // --- Event Listeners ---

    // 1. Settings Menu Toggle
    addFastClick(settingsToggle, (e) => {
        e.stopPropagation();
        settingsMenu.classList.toggle('hidden');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!settingsMenu.contains(e.target) && e.target !== settingsToggle) {
            settingsMenu.classList.add('hidden');
        }
    });

    // 2. Volume Control
    const updateVolume = (val) => {
        let newVol = parseInt(val);
        if (newVol < 0) newVol = 0;
        if (newVol > 100) newVol = 100;

        volumeSlider.value = newVol;
        volumeValue.textContent = newVol + "%";
        engine.setVolume(newVol / 100);
    };

    volumeSlider.addEventListener('input', (e) => updateVolume(e.target.value));
    addFastClick(volMinusBtn, () => updateVolume(parseInt(volumeSlider.value) - 5));
    addFastClick(volPlusBtn, () => updateVolume(parseInt(volumeSlider.value) + 5));

    // 3. BPM Control
    const updateBPM = (val) => {
        let newBPM = parseInt(val);
        if (newBPM < 50) newBPM = 50;
        if (newBPM > 130) newBPM = 130;

        bpmSlider.value = newBPM;
        neonBpmValue.textContent = newBPM;
        engine.setBPM(newBPM);

        if (swingVideo) {
            swingVideo.playbackRate = calculatePlaybackRate(newBPM);
        }
    };

    bpmSlider.addEventListener('input', (e) => updateBPM(e.target.value));
    addFastClick(bpmMinusBtn, () => updateBPM(parseInt(bpmSlider.value) - 1));
    addFastClick(bpmPlusBtn, () => updateBPM(parseInt(bpmSlider.value) + 1));

    // 4. Ratio Control (Immediate Switch)
    ratioBtns.forEach(btn => {
        addFastClick(btn, () => {
            ratioBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const ratio = btn.getAttribute('data-ratio');
            engine.setRatio(ratio);

            // UI Hint: Hide 3rd dot for 2:1 ratio
            if (ratio === "2:1") {
                if (dots[2]) dots[2].style.display = 'none';
            } else {
                if (dots[2]) dots[2].style.display = 'block';
            }
        });
    });

    // 5. Sound Control
    soundBtns.forEach(btn => {
        addFastClick(btn, () => {
            soundBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            engine.setSound(btn.getAttribute('data-sound'));
        });
    });

    // 6. Start / Stop
    addFastClick(startBtn, () => {
        // Ensure audio is unlocked explicitly here as well
        engine.unlock();

        if (engine.isPlaying) {
            engine.stop();
            startBtn.textContent = "시작 (START)";
            startBtn.classList.remove('playing');

            if (swingVideo) {
                swingVideo.pause();
                swingVideo.currentTime = 0;
            }
            impactOverlay.classList.remove('active');
        } else {
            engine.start();
            // Ensure volume is set
            engine.setVolume(parseInt(volumeSlider.value) / 100);

            startBtn.textContent = "중지 (STOP)";
            startBtn.classList.add('playing');
            requestWakeLock();

            if (swingVideo) {
                const rate = calculatePlaybackRate(engine.bpm);
                swingVideo.currentTime = 0;
                swingVideo.playbackRate = rate;
                swingVideo.play().catch(e => {
                    console.log("Video Play Error:", e);
                    alert("비디오 재생 오류: " + e.message);
                });
            }
        }
    });

    // 7. Fullscreen Toggle (Click visual area)
    addFastClick(videoContainer, () => {
        if (!document.fullscreenElement) {
            if (visualArea.requestFullscreen) {
                visualArea.requestFullscreen();
            } else if (visualArea.webkitRequestFullscreen) {
                visualArea.webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    });

    // 8. Help Logic
    // (Help logic can stay as click or normal since it's not time sensitive)
    const helpData = {
        'ratio': {
            title: "스윙 비율 (Swing Ratio)",
            text: "• 3:1 (드라이버): 비거리를 위한 프로들의 표준 리듬입니다.\n• 2:1 (어프로치): 정확한 타격과 가속을 위한 간결한 리듬입니다."
        },
        'bpm': {
            title: "템포 속도 (BPM)",
            text: "• 초보자 권장: 60 ~ 70 BPM\n• 중급/상급 권장: 75 ~ 80 BPM\n\n자신에게 맞는 편안한 속도를 찾아보세요."
        }
    };

    helpIcons.forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = icon.getAttribute('data-help');
            if (helpData[key]) {
                modalTitle.textContent = helpData[key].title;
                modalText.textContent = helpData[key].text;
                helpModal.classList.remove('hidden');
            }
        });
    });

    closeModal.addEventListener('click', () => {
        helpModal.classList.add('hidden');
    });

    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            helpModal.classList.add('hidden');
        }
    });

    // 9. Settings Actions
    addFastClick(resetCountBtn, () => {
        swingCount = 0;
        updateSwingCount();
        // Close menu
        settingsMenu.classList.add('hidden');
    });

    const updateSwingCount = () => {
        swingCountDisplay.textContent = `연습 횟수: ${swingCount}`;
    };

    // Wake Lock
    // (Wake lock is standard click usually fine, but can upgrade)
    wakeLockBtn.addEventListener('click', toggleWakeLock);

    async function toggleWakeLock() {
        if (!('wakeLock' in navigator)) {
            alert("이 브라우저는 화면 켜짐 유지 기능을 지원하지 않습니다.");
            return;
        }

        if (wakeLock) {
            try {
                await wakeLock.release();
                wakeLock = null;
                wakeLockBtn.textContent = "💡 화면 켜짐 유지 (OFF)";
                wakeLockBtn.style.color = "#fff";
            } catch (err) { console.error(err); }
        } else {
            requestWakeLock();
        }
    }

    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                wakeLockBtn.textContent = "💡 화면 켜짐 유지 (ON)";
                wakeLockBtn.style.color = "#00f3ff";

                wakeLock.addEventListener('release', () => {
                    if (wakeLock !== null) wakeLock = null;
                    wakeLockBtn.textContent = "💡 화면 켜짐 유지 (OFF)";
                    wakeLockBtn.style.color = "#fff";
                });
            } catch (err) { }
        }
    }
});
