document.addEventListener('DOMContentLoaded', () => {
    // --- Инициализация элементов ---
    const bgVideo = document.getElementById('bg-video');
    const authorWatermark = document.getElementById('author-watermark');
    const authorNickname = document.getElementById('author-nickname');
    const authorAvatar = document.getElementById('author-avatar');
    const toggleFitBtn = document.getElementById('toggle-fit-btn');
    const toggleBlurBtn = document.getElementById('toggle-blur-btn');
    const toggleWaterBtn = document.getElementById('toggle-water-btn');

    let audioContext, sourceNode, lowPassFilter, gainNode;
    let isAudioContextInit = false;
    let videoFadeInterval, playerFadeInterval;

    // Подготовка анимации ника
    if (authorNickname) {
        const text = authorNickname.textContent;
        authorNickname.innerHTML = '';
        text.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            authorNickname.appendChild(span);
        });
    }

    const player = new Plyr('#player', {
        controls: ['play', 'progress', 'current-time', 'mute', 'volume'],
        volume: 1
    });

    function fadeAudio(mediaElement, targetVolume, duration = 800) {
        const intervalTime = 20;
        const steps = duration / intervalTime;
        const volumeChange = (targetVolume - mediaElement.volume) / steps;
        const isVideo = mediaElement.tagName === 'VIDEO';
        if (isVideo && videoFadeInterval) clearInterval(videoFadeInterval);
        if (!isVideo && playerFadeInterval) clearInterval(playerFadeInterval);
        const fade = setInterval(() => {
            if (Math.abs(mediaElement.volume - targetVolume) < Math.abs(volumeChange) * 1.1) {
                mediaElement.volume = targetVolume;
                if (targetVolume === 0 && !isVideo) mediaElement.pause();
                clearInterval(fade);
            } else {
                mediaElement.volume += volumeChange;
            }
        }, intervalTime);
        if (isVideo) videoFadeInterval = fade;
        else playerFadeInterval = fade;
    }

    function initAudioContext() {
        if (isAudioContextInit) return;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        sourceNode = audioContext.createMediaElementSource(bgVideo);
        lowPassFilter = audioContext.createBiquadFilter();
        lowPassFilter.type = 'lowpass';
        lowPassFilter.frequency.setValueAtTime(400, audioContext.currentTime);
        gainNode = audioContext.createGain();
        sourceNode.connect(lowPassFilter).connect(gainNode).connect(audioContext.destination);
        isAudioContextInit = true;
    }

    player.on('play', () => {
        if (!isAudioContextInit) initAudioContext();
        bgVideo.muted = false; // Включаем звук фона при старте плеера
        player.media.volume = 0;
        fadeAudio(bgVideo, 0.4); // Фон делаем тише
        fadeAudio(player.media, 1);
    });

    player.on('pause', () => {
        fadeAudio(player.media, 0);
        fadeAudio(bgVideo, 1); // Возвращаем громкость фона
    });
    
    player.on('ended', () => {
        fadeAudio(bgVideo, 1);
    });

    function updateEffects(isTransitioning = false) {
        const isWaterOn = toggleWaterBtn && toggleWaterBtn.classList.contains('toggled');
        const isBlurOff = toggleBlurBtn && toggleBlurBtn.classList.contains('toggled');
        
        let filterValue = '';
        if (isTransitioning) filterValue = 'blur(1px)';
        else if(isBlurOff) filterValue = 'blur(0) brightness(0.9)';
        else filterValue = 'blur(var(--background-blur)) brightness(0.6)';

        if(isWaterOn) {
            // Эта логика будет добавлена ниже
        }
        
        bgVideo.style.filter = filterValue;

        if (isAudioContextInit) {
            const targetFrequency = isWaterOn ? 400 : 20000;
            lowPassFilter.frequency.linearRampToValueAtTime(targetFrequency, audioContext.currentTime + 1.0);
        }
    }

    if (toggleWaterBtn) {
        toggleWaterBtn.classList.add('toggled');
        toggleWaterBtn.addEventListener('click', () => {
            toggleWaterBtn.classList.toggle('toggled');
            updateEffects();
        });
    }
    
    if (toggleBlurBtn) {
        toggleBlurBtn.addEventListener('click', () => {
            toggleBlurBtn.classList.toggle('toggled');
            updateEffects();
        });
    }

    // Логика анимации аватара и ника
    if (toggleFitBtn && bgVideo && authorWatermark && authorNickname && authorAvatar) {
        const letters = authorNickname.querySelectorAll('span');
        toggleFitBtn.addEventListener('click', () => {
            bgVideo.classList.add('is-transitioning');
            toggleFitBtn.classList.toggle('toggled');
            const isSizeMode = bgVideo.classList.toggle('original-size-mode');
            
            authorWatermark.classList.toggle('visible', isSizeMode);
            
            if (isSizeMode) {
                authorAvatar.classList.remove('hiding');
                authorAvatar.classList.add('appearing');
                letters.forEach(span => { span.style.transform = 'translate(0, 0) rotate(0) scale(1)'; });
                setTimeout(() => {
                    authorAvatar.classList.remove('appearing');
                    authorAvatar.classList.add('looping');
                }, 1200);
            } else {
                authorAvatar.classList.remove('looping');
                authorAvatar.classList.add('hiding');
                letters.forEach(span => {
                    const x = (Math.random() - 0.5) * 400;
                    const y = (Math.random() - 0.5) * 300;
                    const rot = (Math.random() - 0.5) * 720;
                    const scale = Math.random() * 0.4;
                    span.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`;
                });
            }
            
            setTimeout(() => {
                bgVideo.classList.remove('is-transitioning');
                if (!isSizeMode) authorAvatar.classList.remove('hiding');
            }, 800);
        });
    }
    
    updateEffects(); // Первоначальная установка эффектов
});